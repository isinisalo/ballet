import { mkdir, open, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConfigSnapshotStore } from "./ConfigSnapshotStore.js";
import { RootWorkspaceFinalizer } from "./RootWorkspaceFinalizer.js";
import { runGit } from "./gitProcess.js";
import { inspectGitCheckout } from "./gitStatus.js";
import type {
  FinalizedGitWorkspace,
  GitCheckoutStatus,
  ManagedRunState,
  PreparedGitWorkspace,
  PrepareGitWorkspaceRequest
} from "./GitWorkspaceTypes.js";

export interface GitWorkspaceManagerOptions {
  root: string;
  commitName?: string;
  commitEmail?: string;
}

export class GitWorkspaceManager {
  private readonly root: string;
  private readonly commitName: string;
  private readonly commitEmail: string;
  private readonly snapshots: ConfigSnapshotStore;
  private readonly rootFinalizer: RootWorkspaceFinalizer;

  constructor(options: GitWorkspaceManagerOptions) {
    this.root = path.resolve(options.root);
    this.commitName = options.commitName ?? "Ballet Daemon";
    this.commitEmail = options.commitEmail ?? "daemon@ballet.local";
    this.snapshots = new ConfigSnapshotStore(path.join(this.root, "cache", "config-snapshots"));
    this.rootFinalizer = new RootWorkspaceFinalizer({
      projectPath: (projectId) => this.projectPath(projectId),
      repositoryPath: (projectId) => this.repositoryPath(projectId),
      worktreePath: (projectId, rootRunId) => this.worktreePath(projectId, rootRunId),
      statePath: (projectId, rootRunId) => this.statePath(projectId, rootRunId),
      reportPath: (projectId, rootRunId) => this.finalizationPath(projectId, rootRunId),
      expectedBranch: (rootRunId) => `ballet/run/${shortRunId(rootRunId)}`,
      acquireLock: (projectId, rootRunId, executionId) => this.acquireLock(projectId, rootRunId, executionId),
      commitSuccess: (workspace, signal) => this.commitSuccess(workspace, signal)
    });
  }

  inspect(root: string, signal?: AbortSignal): Promise<GitCheckoutStatus> {
    return inspectGitCheckout(root, signal);
  }

  async inspectManagedProject(projectId: string, signal?: AbortSignal): Promise<GitCheckoutStatus & { snapshotHash: string }> {
    const repository = this.repositoryPath(projectId);
    const [status, snapshot] = await Promise.all([
      inspectGitCheckout(repository, signal),
      this.snapshots.capture(repository)
    ]);
    return { ...status, snapshotHash: snapshot.hash };
  }

  repositoryPathFor(projectId: string): string {
    return this.repositoryPath(projectId);
  }

  async cloneProject(projectId: string, repositoryUrl: string, signal?: AbortSignal): Promise<GitCheckoutStatus> {
    const target = this.repositoryPath(projectId);
    if (await exists(target)) {
      const origin = (await runGit(["remote", "get-url", "origin"], { cwd: target, signal })).stdout.trim();
      if (origin !== repositoryUrl) throw new Error(`Managed checkout origin mismatch: expected ${repositoryUrl}, found ${origin}.`);
      return this.inspect(target, signal);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await runGit(["clone", "--", repositoryUrl, target], { signal });
    return this.inspect(target, signal);
  }

  async prepare(request: PrepareGitWorkspaceRequest, signal?: AbortSignal): Promise<PreparedGitWorkspace> {
    validateRequest(request);
    const repositoryPath = this.repositoryPath(request.projectId);
    const statePath = this.statePath(request.projectId, request.rootRunId);
    const existing = await this.loadRunState(statePath);
    if (existing) return this.reopenExisting(request, existing, repositoryPath, signal);

    const origin = (await runGit(["remote", "get-url", "origin"], { cwd: repositoryPath, signal })).stdout.trim();
    if (origin !== request.repositoryUrl) throw new Error(`Managed checkout origin mismatch: expected ${request.repositoryUrl}, found ${origin}.`);
    await runGit(["cat-file", "-e", `${request.headSha}^{commit}`], { cwd: repositoryPath, signal });
    const treeSha = (await runGit(["rev-parse", `${request.headSha}^{tree}`], { cwd: repositoryPath, signal })).stdout.trim();
    // Start already captured the immutable config into the local CAS and put
    // its hash in ExecutionSpec. Never recapture mutable source-checkout state
    // while a queued/root run is being prepared or resumed.
    const snapshot = await this.snapshots.load(request.expectedSnapshotHash);

    const worktreePath = this.worktreePath(request.projectId, request.rootRunId);
    if (await exists(worktreePath)) throw new Error(`Untracked run worktree already exists: ${worktreePath}`);
    const branch = `ballet/run/${shortRunId(request.rootRunId)}`;
    const branchExists = await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: repositoryPath,
      signal,
      allowedExitCodes: [1]
    });
    if (branchExists.exitCode === 0) throw new Error(`Run branch ${branch} already exists without active run state.`);
    await mkdir(path.dirname(worktreePath), { recursive: true });
    await runGit(["worktree", "add", "-b", branch, worktreePath, request.headSha], { cwd: repositoryPath, signal });
    await this.snapshots.materialize(snapshot, worktreePath);
    const state: ManagedRunState = {
      version: 1,
      rootRunId: request.rootRunId,
      projectId: request.projectId,
      repositoryUrl: request.repositoryUrl,
      branch,
      worktreePath,
      baseHeadSha: request.headSha,
      treeSha,
      snapshotHash: snapshot.hash
    };
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify(state), { flag: "wx", mode: 0o600 });
    const lockPath = await this.acquireLock(request.projectId, request.rootRunId, request.executionId);
    return preparedFrom(request, state, repositoryPath, lockPath);
  }

  async release(workspace: PreparedGitWorkspace): Promise<void> {
    await rm(workspace.lockPath, { force: true });
  }

  async finalize(
    workspace: PreparedGitWorkspace,
    success: boolean,
    signal?: AbortSignal
  ): Promise<FinalizedGitWorkspace> {
    await this.release(workspace);
    return this.rootFinalizer.finalize(workspace.projectId, workspace.rootRunId, success, signal);
  }

  finalizeRoot(projectId: string, rootRunId: string, success: boolean, signal?: AbortSignal): Promise<FinalizedGitWorkspace> {
    return this.rootFinalizer.finalize(projectId, rootRunId, success, signal);
  }

  acknowledgeFinalization(projectId: string, rootRunId: string): Promise<void> {
    return rm(this.finalizationPath(projectId, rootRunId), { force: true });
  }

  private async reopenExisting(
    request: PrepareGitWorkspaceRequest,
    state: ManagedRunState,
    repositoryPath: string,
    signal?: AbortSignal
  ): Promise<PreparedGitWorkspace> {
    const expectedPath = this.worktreePath(request.projectId, request.rootRunId);
    const expectedBranch = `ballet/run/${shortRunId(request.rootRunId)}`;
    if (state.projectId !== request.projectId || state.rootRunId !== request.rootRunId
      || path.resolve(state.worktreePath) !== expectedPath || state.branch !== expectedBranch) {
      throw new Error("Existing run state failed project, branch, or worktree path verification.");
    }
    if (state.baseHeadSha !== request.headSha || state.snapshotHash !== request.expectedSnapshotHash) {
      throw new Error("Existing run worktree does not match the immutable execution snapshot.");
    }
    const checkout = await inspectGitCheckout(state.worktreePath, signal);
    const canonicalExpected = await realpath(expectedPath);
    const canonicalProject = await realpath(this.projectPath(request.projectId));
    if (checkout.root !== canonicalExpected || !isWithin(canonicalExpected, canonicalProject)) {
      throw new Error("Run worktree resolved outside its managed project directory.");
    }
    if (checkout.branch !== state.branch) throw new Error(`Run worktree branch changed from ${state.branch} to ${checkout.branch ?? "detached"}.`);
    const descendant = await runGit(["merge-base", "--is-ancestor", state.baseHeadSha, "HEAD"], {
      cwd: state.worktreePath,
      signal,
      allowedExitCodes: [1]
    });
    if (descendant.exitCode !== 0) throw new Error("Run worktree HEAD is no longer descended from its immutable base commit.");
    const lockPath = await this.acquireLock(request.projectId, request.rootRunId, request.executionId);
    return preparedFrom(request, state, repositoryPath, lockPath);
  }

  private async commitSuccess(workspace: PreparedGitWorkspace, signal?: AbortSignal): Promise<string> {
    await runGit(["add", "-A"], { cwd: workspace.path, signal });
    const staged = await runGit(["diff", "--cached", "--quiet"], { cwd: workspace.path, signal, allowedExitCodes: [1] });
    if (staged.exitCode === 1) {
      await runGit([
        "-c", `user.name=${this.commitName}`,
        "-c", `user.email=${this.commitEmail}`,
        "commit", "-m", `chore(ballet): complete run ${shortRunId(workspace.rootRunId)}`
      ], { cwd: workspace.path, signal });
    }
    return (await runGit(["rev-parse", "HEAD"], { cwd: workspace.path, signal })).stdout.trim();
  }

  private async acquireLock(projectId: string, rootRunId: string, executionId: string): Promise<string> {
    const lockPath = path.join(this.projectPath(projectId), "locks", `${safeName(rootRunId)}.lock`);
    await mkdir(path.dirname(lockPath), { recursive: true });
    let handle = await open(lockPath, "wx", 0o600).catch(() => undefined);
    if (!handle && await lockIsStale(lockPath)) {
      await rm(lockPath, { force: true });
      handle = await open(lockPath, "wx", 0o600).catch(() => undefined);
    }
    if (!handle) throw new Error(`Run ${rootRunId} is already executing on this device.`);
    await handle.writeFile(JSON.stringify({ executionId, pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
    return lockPath;
  }

  private async loadRunState(target: string): Promise<ManagedRunState | undefined> {
    try {
      const state = JSON.parse(await readFile(target, "utf8")) as ManagedRunState;
      if (state.version !== 1) throw new Error(`Unsupported run worktree state at ${target}.`);
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private projectPath(projectId: string): string {
    return path.join(this.root, "projects", safeName(projectId));
  }

  private repositoryPath(projectId: string): string {
    return path.join(this.projectPath(projectId), "repo");
  }

  private worktreePath(projectId: string, rootRunId: string): string {
    return path.join(this.projectPath(projectId), "worktrees", safeName(rootRunId));
  }

  private statePath(projectId: string, rootRunId: string): string {
    return path.join(this.projectPath(projectId), "runs", `${safeName(rootRunId)}.json`);
  }

  private finalizationPath(projectId: string, rootRunId: string): string {
    return path.join(this.projectPath(projectId), "finalizations", `${safeName(rootRunId)}.json`);
  }
}

const preparedFrom = (
  request: PrepareGitWorkspaceRequest,
  state: ManagedRunState,
  repositoryPath: string,
  lockPath: string
): PreparedGitWorkspace => ({
  executionId: request.executionId,
  rootRunId: request.rootRunId,
  projectId: request.projectId,
  repositoryUrl: request.repositoryUrl,
  mode: "managed-worktree",
  path: state.worktreePath,
  headSha: state.baseHeadSha,
  treeSha: state.treeSha,
  snapshotHash: state.snapshotHash,
  branch: state.branch,
  repositoryPath,
  lockPath
});

const validateRequest = (request: PrepareGitWorkspaceRequest): void => {
  if (!/^[0-9a-f]{40}$/i.test(request.headSha)) throw new Error("Execution headSha must be a full 40-character Git SHA.");
  if (!/^[0-9a-f]{64}$/i.test(request.expectedSnapshotHash)) throw new Error("Execution snapshotHash must be SHA-256 hex.");
};

const shortRunId = (value: string): string => safeName(value).slice(0, 12);
const safeName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "run";
const exists = async (target: string): Promise<boolean> => stat(target).then(() => true, () => false);
const isWithin = (candidate: string, root: string): boolean => candidate === root || candidate.startsWith(`${root}${path.sep}`);

const lockIsStale = async (target: string): Promise<boolean> => {
  try {
    const lock = JSON.parse(await readFile(target, "utf8")) as { pid?: unknown };
    if (!Number.isInteger(lock.pid) || Number(lock.pid) < 1) return false;
    try {
      process.kill(Number(lock.pid), 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ESRCH";
    }
  } catch {
    return false;
  }
};
