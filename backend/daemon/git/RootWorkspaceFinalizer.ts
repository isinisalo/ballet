import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FinalizedGitWorkspace, ManagedRunState, PreparedGitWorkspace } from "./GitWorkspaceTypes.js";
import { changedFiles } from "./gitChanges.js";
import { runGit } from "./gitProcess.js";
import { inspectGitCheckout } from "./gitStatus.js";

interface PersistedRootFinalization {
  version: 1;
  projectId: string;
  rootRunId: string;
  requestedSuccess: boolean;
  report: FinalizedGitWorkspace;
}

export interface RootWorkspaceFinalizerOptions {
  projectPath(projectId: string): string;
  repositoryPath(projectId: string): string;
  worktreePath(projectId: string, rootRunId: string): string;
  statePath(projectId: string, rootRunId: string): string;
  reportPath(projectId: string, rootRunId: string): string;
  expectedBranch(rootRunId: string): string;
  acquireLock(projectId: string, rootRunId: string, executionId: string): Promise<string>;
  commitSuccess(workspace: PreparedGitWorkspace, signal?: AbortSignal): Promise<string>;
}

export class RootWorkspaceFinalizer {
  constructor(private readonly options: RootWorkspaceFinalizerOptions) {}

  async finalize(
    projectId: string,
    rootRunId: string,
    success: boolean,
    signal?: AbortSignal
  ): Promise<FinalizedGitWorkspace> {
    const lockPath = await this.options.acquireLock(projectId, rootRunId, `root-finalize:${rootRunId}`);
    try {
      const reportPath = this.options.reportPath(projectId, rootRunId);
      const persisted = await loadPersisted(reportPath);
      if (persisted) {
        verifyPersisted(persisted, projectId, rootRunId, success);
        await this.resumeSuccessfulCleanup(persisted.report, projectId, rootRunId, signal);
        return persisted.report;
      }
      const statePath = this.options.statePath(projectId, rootRunId);
      const state = await loadRunState(statePath);
      if (!state) throw new Error(`No retained worktree exists for root run ${rootRunId}.`);
      const workspace = await this.reopen(state, projectId, rootRunId, lockPath, signal);
      const commitSha = success ? await this.options.commitSuccess(workspace, signal) : undefined;
      const report = resultFor(workspace, success, commitSha, await changedFiles(workspace.path, workspace.headSha, signal));
      await persist(reportPath, { version: 1, projectId, rootRunId, requestedSuccess: success, report });
      if (success) await this.removeSuccessfulWorktree(workspace.repositoryPath, workspace.path, statePath, signal);
      return report;
    } finally {
      await rm(lockPath, { force: true });
    }
  }

  private async reopen(
    state: ManagedRunState,
    projectId: string,
    rootRunId: string,
    lockPath: string,
    signal?: AbortSignal
  ): Promise<PreparedGitWorkspace> {
    verifyState(state, projectId, rootRunId, this.options.expectedBranch(rootRunId));
    const repositoryPath = this.options.repositoryPath(projectId);
    const expectedWorktree = this.options.worktreePath(projectId, rootRunId);
    if (path.resolve(state.worktreePath) !== expectedWorktree) throw new Error("Retained root worktree path does not match its managed location.");
    const [checkout, canonicalExpected, canonicalProject] = await Promise.all([
      inspectGitCheckout(state.worktreePath, signal),
      realpath(expectedWorktree),
      realpath(this.options.projectPath(projectId))
    ]);
    if (checkout.root !== canonicalExpected || !isWithin(canonicalExpected, canonicalProject)) {
      throw new Error("Retained root worktree resolved outside its managed project directory.");
    }
    if (checkout.branch !== state.branch) throw new Error("Retained root worktree branch no longer matches its run state.");
    const origin = (await runGit(["remote", "get-url", "origin"], { cwd: repositoryPath, signal })).stdout.trim();
    if (origin !== state.repositoryUrl) throw new Error("Retained root worktree repository origin changed after execution.");
    const descendant = await runGit(["merge-base", "--is-ancestor", state.baseHeadSha, "HEAD"], {
      cwd: state.worktreePath,
      signal,
      allowedExitCodes: [1]
    });
    if (descendant.exitCode !== 0) throw new Error("Retained root worktree is no longer descended from its immutable base commit.");
    return {
      executionId: `root-finalize:${rootRunId}`,
      rootRunId,
      projectId,
      repositoryUrl: state.repositoryUrl,
      mode: "managed-worktree",
      path: state.worktreePath,
      headSha: state.baseHeadSha,
      treeSha: state.treeSha,
      snapshotHash: state.snapshotHash,
      branch: state.branch,
      repositoryPath,
      lockPath
    };
  }

  private async resumeSuccessfulCleanup(
    report: FinalizedGitWorkspace,
    projectId: string,
    rootRunId: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (!report.success || report.retained) return;
    const expected = this.options.worktreePath(projectId, rootRunId);
    if (path.resolve(report.worktreePath) !== expected) throw new Error("Persisted root finalization has an invalid worktree path.");
    await this.removeSuccessfulWorktree(
      this.options.repositoryPath(projectId),
      expected,
      this.options.statePath(projectId, rootRunId),
      signal
    );
  }

  private async removeSuccessfulWorktree(
    repositoryPath: string,
    worktreePath: string,
    statePath: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (await exists(worktreePath)) {
      await runGit(["worktree", "remove", "--force", worktreePath], { cwd: repositoryPath, signal });
    }
    await rm(statePath, { force: true });
  }
}

const loadRunState = async (target: string): Promise<ManagedRunState | undefined> => {
  try {
    return JSON.parse(await readFile(target, "utf8")) as ManagedRunState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const loadPersisted = async (target: string): Promise<PersistedRootFinalization | undefined> => {
  try {
    return JSON.parse(await readFile(target, "utf8")) as PersistedRootFinalization;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const persist = async (target: string, value: PersistedRootFinalization): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, target);
};

const verifyState = (state: ManagedRunState, projectId: string, rootRunId: string, branch: string): void => {
  if (state.version !== 1 || state.projectId !== projectId || state.rootRunId !== rootRunId || state.branch !== branch) {
    throw new Error("Retained root run state failed identity verification.");
  }
  if (!state.repositoryUrl || !/^[0-9a-f]{40}$/i.test(state.baseHeadSha)
    || !/^[0-9a-f]{40}$/i.test(state.treeSha) || !/^[0-9a-f]{64}$/i.test(state.snapshotHash)) {
    throw new Error("Retained root run state is malformed.");
  }
};

const verifyPersisted = (
  persisted: PersistedRootFinalization,
  projectId: string,
  rootRunId: string,
  success: boolean
): void => {
  if (persisted.version !== 1 || persisted.projectId !== projectId || persisted.rootRunId !== rootRunId
    || persisted.requestedSuccess !== success || persisted.report.success !== success) {
    throw new Error("Persisted root finalization does not match the requested terminal disposition.");
  }
};

const resultFor = (
  workspace: PreparedGitWorkspace,
  success: boolean,
  commitSha: string | undefined,
  changed: string[]
): FinalizedGitWorkspace => ({
  success,
  retained: !success,
  branch: workspace.branch,
  worktreePath: workspace.path,
  commitSha,
  changedFiles: changed,
  snapshotHash: workspace.snapshotHash
});

const exists = async (target: string): Promise<boolean> => stat(target).then(() => true, () => false);
const isWithin = (candidate: string, root: string): boolean => candidate === root || candidate.startsWith(`${root}${path.sep}`);
