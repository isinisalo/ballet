import { lstat, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ProductSnapshotSeed } from "../../../shared/vnext/persistence.js";
import type { StoredEnvironmentRun } from "../../../shared/vnext/persistenceRecords.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/vnext/primitives.js";
import { changedFiles } from "../../execution/git/gitChanges.js";
import { runGit } from "../../execution/git/gitProcess.js";
import type { VNextWorkspacePort } from "../http/VNextApiController.js";
import type { GovernanceWorkspaceBoundary } from "../governance/GovernanceExecutionService.js";
import type { ProductFinalizationPort } from "./EnvironmentRuntimeService.js";

export class VNextWorkspaceManager implements VNextWorkspacePort, ProductFinalizationPort, GovernanceWorkspaceBoundary {
  constructor(
    private readonly root: string,
    private readonly worktreesRoot: string,
    private readonly nextId: (kind: string) => string
  ) {}

  async prepare(runId: string, expectedBaseCommit?: string): Promise<{ worktreePath: string; branch: string }> {
    const status = (await runGit(["status", "--porcelain=v1"], { cwd: this.root })).stdout.trim();
    if (status) throw new Error("Commit or stash project changes before starting an immutable vNext Run.");
    const branch = `ballet/vnext-run/${safeId(runId)}`;
    const worktreePath = path.join(this.worktreesRoot, safeId(runId));
    const base = (await runGit(["rev-parse", "HEAD"], { cwd: this.root })).stdout.trim();
    if (expectedBaseCommit && base !== expectedBaseCommit) {
      throw new Error("Project HEAD changed after immutable vNext planning.");
    }
    await mkdir(this.worktreesRoot, { recursive: true, mode: 0o700 });
    await assertOrdinaryDirectory(this.worktreesRoot);
    await runGit(["worktree", "add", "-b", branch, worktreePath, base], { cwd: this.root });
    return { worktreePath, branch };
  }

  async discard(runId: string): Promise<void> {
    const branch = `ballet/vnext-run/${safeId(runId)}`;
    const worktreePath = path.join(this.worktreesRoot, safeId(runId));
    await runGit(["worktree", "remove", "--force", worktreePath], {
      cwd: this.root, allowedExitCodes: [1, 128]
    }).catch(() => undefined);
    await runGit(["branch", "-D", branch], { cwd: this.root, allowedExitCodes: [1, 128] }).catch(() => undefined);
  }

  async prepareReadOnly(taskId: string, commitSha: string): Promise<string> {
    const directory = path.join(this.worktreesRoot, "governance");
    const worktreePath = path.join(directory, safeId(taskId));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await assertOrdinaryDirectory(this.worktreesRoot); await assertOrdinaryDirectory(directory);
    const metadata = await lstat(worktreePath).catch(() => undefined);
    if (metadata) {
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new Error(`Governance worktree ${taskId} is not an ordinary directory.`);
      }
      const observed = (await runGit(["rev-parse", "HEAD"], { cwd: worktreePath })).stdout.trim();
      if (observed !== commitSha) throw new Error(`Governance worktree ${taskId} has an unexpected commit.`);
      return worktreePath;
    }
    await runGit(["worktree", "add", "--detach", worktreePath, commitSha], { cwd: this.root });
    return worktreePath;
  }

  async releaseReadOnly(taskId: string): Promise<void> {
    const worktreePath = path.join(this.worktreesRoot, "governance", safeId(taskId));
    await runGit(["worktree", "remove", "--force", worktreePath], {
      cwd: this.root, allowedExitCodes: [1, 128]
    }).catch(() => undefined);
  }

  async finalize(run: StoredEnvironmentRun, at: string): Promise<ProductSnapshotSeed> {
    const paths = (await changedFiles(run.worktreePath, run.baseCommit)).sort();
    await runGit(["add", "-A"], { cwd: run.worktreePath });
    const staged = await runGit(["diff", "--cached", "--quiet"], { cwd: run.worktreePath, allowedExitCodes: [1] });
    if (staged.exitCode === 1) await runGit([
      "-c", "user.name=Ballet", "-c", "user.email=ballet@localhost", "commit",
      "-m", `chore(ballet): complete environment run ${safeId(run.environmentRunId)}`
    ], { cwd: run.worktreePath });
    const resultCommit = (await runGit(["rev-parse", "HEAD"], { cwd: run.worktreePath })).stdout.trim();
    await runGit(["worktree", "remove", "--force", run.worktreePath], { cwd: this.root });
    return {
      productSnapshotId: this.nextId("product-snapshot"), environmentRunId: run.environmentRunId,
      branch: run.branch, worktreePath: run.worktreePath, baseCommit: run.baseCommit, resultCommit,
      changedFiles: paths, artifactRefs: [],
      resourceHashes: Object.fromEntries(run.executionSnapshot.resources.map(({ id, sourceSha256 }) => [id, sourceSha256])),
      definitionHashes: Object.fromEntries([
        [run.executionSnapshot.environment.id, run.executionSnapshot.environmentSha256],
        ...run.executionSnapshot.environment.states.flatMap((state) => state.actions.map((action) => [action.id, hashForAction(run, action.id)] as const))
      ]),
      validationSummary: { completedActions: run.executionSnapshot.environment.states.reduce((count, state) => count + state.actions.length, 0) },
      createdAt: at
    };
  }
}

const hashForAction = (run: StoredEnvironmentRun, actionId: string): string => {
  const row = run.executionSnapshot.environment.states.flatMap(({ actions }) => actions).find(({ id }) => id === actionId);
  return row ? sha256(canonicalJson(row as unknown as JsonValue)) : "missing";
};
const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
const assertOrdinaryDirectory = async (directory: string): Promise<void> => {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`${directory} must be an ordinary directory.`);
};
