import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RootFinalizationReport } from "../../../shared/domain/runtime.js";
import type { ProjectContext } from "../../project/ProjectContext.js";
import type { StoredRootRun } from "../../runs/RootRunStore.js";
import { changedFiles } from "./gitChanges.js";
import { runGit } from "./gitProcess.js";
import { inspectGitCheckout } from "./gitStatus.js";

const SNAPSHOT_ROOTS = [".ballet", ".codex/agents", ".agents/skills"] as const;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 10_000;

export interface PreparedRootWorkspace {
  path: string;
  branch: string;
  headSha: string;
  configHash: string;
  snapshotHash: string;
}

export class LocalWorkspaceManager {
  constructor(private readonly context: ProjectContext) {}

  async inspect(signal?: AbortSignal) {
    const checkout = await inspectGitCheckout(this.context.root, signal);
    return { ...checkout, configHash: await configManifestHash(this.context.root) };
  }

  async prepare(rootRunId: string, signal?: AbortSignal): Promise<PreparedRootWorkspace> {
    const checkout = await this.inspect(signal);
    if (checkout.codeDirty) {
      throw new Error(`Commit or stash source changes before starting a Run: ${checkout.dirtyPaths.join(", ")}`);
    }
    const worktreePath = path.join(this.context.worktreesRoot, rootRunId);
    if (await exists(worktreePath)) throw new Error(`Run worktree already exists: ${worktreePath}`);
    const branch = `ballet/run/${safeRunId(rootRunId)}`;
    const branchExists = await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: this.context.root, signal, allowedExitCodes: [1]
    });
    if (branchExists.exitCode === 0) throw new Error(`Run branch ${branch} already exists.`);
    const snapshot = await captureSnapshot(this.context.root);
    await mkdir(path.dirname(worktreePath), { recursive: true, mode: 0o700 });
    try {
      await runGit(["worktree", "add", "-b", branch, worktreePath, checkout.headSha], { cwd: this.context.root, signal });
      await materializeSnapshot(snapshot, worktreePath);
    } catch (error) {
      if (await exists(worktreePath)) {
        await runGit(["worktree", "remove", "--force", worktreePath], {
          cwd: this.context.root, signal, allowedExitCodes: [1, 128]
        }).catch(() => undefined);
      }
      await runGit(["branch", "-D", branch], {
        cwd: this.context.root, signal, allowedExitCodes: [1, 128]
      }).catch(() => undefined);
      throw error;
    }
    return {
      path: worktreePath,
      branch,
      headSha: checkout.headSha,
      configHash: snapshot.hash,
      snapshotHash: snapshot.hash
    };
  }

  async finalize(run: StoredRootRun, success: boolean, signal?: AbortSignal): Promise<RootFinalizationReport> {
    await this.verify(run, signal);
    const changed = await changedFiles(run.worktreePath, run.headSha, signal);
    const commitSha = success ? await this.commit(run, signal) : undefined;
    return {
      success,
      retained: !success,
      branch: run.branch,
      worktreePath: run.worktreePath,
      commitSha,
      changedFiles: changed,
      snapshotHash: run.snapshotHash
    };
  }

  async cleanupSuccessful(run: StoredRootRun, signal?: AbortSignal): Promise<void> {
    if (!await exists(run.worktreePath)) return;
    await runGit(["worktree", "remove", "--force", run.worktreePath], { cwd: this.context.root, signal });
  }

  async discard(workspace: PreparedRootWorkspace, signal?: AbortSignal): Promise<void> {
    if (await exists(workspace.path)) await runGit(["worktree", "remove", "--force", workspace.path], {
      cwd: this.context.root, signal, allowedExitCodes: [1, 128]
    });
    await runGit(["branch", "-D", workspace.branch], {
      cwd: this.context.root, signal, allowedExitCodes: [1, 128]
    });
  }

  async cleanupOrphans(knownRootRunIds: ReadonlySet<string>, signal?: AbortSignal): Promise<void> {
    const entries = await readdir(this.context.worktreesRoot, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || knownRootRunIds.has(entry.name)) continue;
      const workspace: PreparedRootWorkspace = {
        path: path.join(this.context.worktreesRoot, entry.name),
        branch: `ballet/run/${safeRunId(entry.name)}`,
        headSha: "", configHash: "", snapshotHash: ""
      };
      await this.discard(workspace, signal);
    }
  }

  private async verify(run: StoredRootRun, signal?: AbortSignal): Promise<void> {
    if (path.resolve(run.worktreePath) !== path.join(this.context.worktreesRoot, run.rootRunId)) {
      throw new Error("Run worktree is outside the checkout state root.");
    }
    const checkout = await inspectGitCheckout(run.worktreePath, signal);
    if (checkout.root !== path.resolve(run.worktreePath) || checkout.branch !== run.branch) {
      throw new Error("Run worktree no longer matches its persisted branch.");
    }
    const ancestor = await runGit(["merge-base", "--is-ancestor", run.headSha, "HEAD"], {
      cwd: run.worktreePath, signal, allowedExitCodes: [1]
    });
    if (ancestor.exitCode !== 0) throw new Error("Run worktree HEAD no longer descends from its immutable base.");
  }

  private async commit(run: StoredRootRun, signal?: AbortSignal): Promise<string> {
    await runGit(["add", "-A"], { cwd: run.worktreePath, signal });
    const clean = await runGit(["diff", "--cached", "--quiet"], {
      cwd: run.worktreePath, signal, allowedExitCodes: [1]
    });
    if (clean.exitCode === 1) await runGit([
      "-c", "user.name=Ballet", "-c", "user.email=ballet@localhost",
      "commit", "-m", `chore(ballet): complete run ${safeRunId(run.rootRunId)}`
    ], { cwd: run.worktreePath, signal });
    return (await runGit(["rev-parse", "HEAD"], { cwd: run.worktreePath, signal })).stdout.trim();
  }
}

interface SnapshotFile { relativePath: string; mode: number; bytes: Buffer; hash: string }
interface Snapshot { hash: string; files: SnapshotFile[] }

const captureSnapshot = async (root: string): Promise<Snapshot> => {
  const result = await runGit(["ls-files", "-co", "--exclude-standard", "-z", "--", ...SNAPSHOT_ROOTS], { cwd: root });
  const paths = [...new Set(result.stdout.split("\0").filter(Boolean))].sort();
  const files: SnapshotFile[] = [];
  let totalBytes = 0;
  for (const relativePath of paths) {
    assertSnapshotPath(relativePath);
    const absolute = path.join(root, relativePath);
    const metadata = await lstat(absolute).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (!metadata) continue;
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Snapshot path must be a regular file: ${relativePath}`);
    if (metadata.size > MAX_FILE_BYTES) throw new Error(`Snapshot file exceeds 32 MiB: ${relativePath}`);
    totalBytes += metadata.size;
    if (totalBytes > MAX_SNAPSHOT_BYTES) throw new Error("Configuration snapshot exceeds 256 MiB.");
    if (files.length >= MAX_FILES) throw new Error("Configuration snapshot exceeds 10,000 files.");
    const bytes = await readFile(absolute);
    files.push({ relativePath, mode: metadata.mode & 0o777, bytes, hash: sha256(bytes) });
  }
  const manifest = files.map(({ relativePath, mode, hash }) => ({ relativePath, mode, hash }));
  return { hash: sha256(Buffer.from(JSON.stringify(manifest))), files };
};

const materializeSnapshot = async (snapshot: Snapshot, target: string): Promise<void> => {
  for (const root of SNAPSHOT_ROOTS) await rm(path.join(target, root), { recursive: true, force: true });
  for (const file of snapshot.files) {
    const destination = path.join(target, file.relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { mode: file.mode });
    await chmod(destination, file.mode);
  }
};

export const configManifestHash = async (root: string): Promise<string> => (await captureSnapshot(root)).hash;
const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const exists = (target: string): Promise<boolean> => stat(target).then(() => true, () => false);
const safeRunId = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 36);
const assertSnapshotPath = (value: string): void => {
  if (value.includes("\\") || path.posix.isAbsolute(value) || value.split("/").some((part) => !part || part === "." || part === "..")
    || !SNAPSHOT_ROOTS.some((root) => value === root || value.startsWith(`${root}/`))) {
    throw new Error(`Unsafe configuration snapshot path: ${value}`);
  }
};
