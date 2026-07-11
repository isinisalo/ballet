import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runGit } from "./gitProcess.js";

const CONFIG_ROOTS = [".ballet", ".codex/agents", ".agents/skills"] as const;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 10_000;

export interface ConfigSnapshotEntry {
  path: string;
  mode: number;
  contentHash: string;
}

export interface ConfigSnapshotManifest {
  version: 1;
  files: ConfigSnapshotEntry[];
}

export interface StoredConfigSnapshot {
  hash: string;
  manifest: ConfigSnapshotManifest;
}

export class ConfigSnapshotStore {
  constructor(private readonly cacheRoot: string) {}

  async capture(checkoutRoot: string, expectedHash?: string): Promise<StoredConfigSnapshot> {
    const files: ConfigSnapshotEntry[] = [];
    let totalBytes = 0;
    const listed = await runGit(["ls-files", "-co", "--exclude-standard", "-z", "--", ...CONFIG_ROOTS], { cwd: checkoutRoot });
    const snapshotPaths = [...new Set(listed.stdout.split("\0").filter(Boolean))]
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
    for (const relativePath of snapshotPaths) {
        const absolutePath = path.join(checkoutRoot, ...relativePath.split("/"));
        const metadata = await lstat(absolutePath);
        if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Config snapshots accept regular files only: ${relativePath}`);
        if (metadata.size > MAX_FILE_BYTES) throw new Error(`Config snapshot file is too large: ${relativePath}`);
        totalBytes += metadata.size;
        if (totalBytes > MAX_SNAPSHOT_BYTES) throw new Error("Config snapshot exceeds the 256 MB safety limit.");
        const content = await readFile(absolutePath);
        const contentHash = sha256(content);
        await this.storeBlob(contentHash, content);
        files.push({ path: relativePath, mode: metadata.mode & 0o777, contentHash });
        if (files.length > MAX_FILES) throw new Error("Config snapshot exceeds the 10,000 file safety limit.");
    }
    files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    const manifest: ConfigSnapshotManifest = { version: 1, files };
    const hash = sha256(Buffer.from(JSON.stringify(manifest), "utf8"));
    if (expectedHash && expectedHash !== hash) {
      throw new Error(`Config snapshot hash mismatch: expected ${expectedHash}, captured ${hash}.`);
    }
    await this.storeManifest(hash, manifest);
    return { hash, manifest };
  }

  async load(hash: string): Promise<StoredConfigSnapshot> {
    if (!/^[0-9a-f]{64}$/i.test(hash)) throw new Error("Config snapshot hash must be SHA-256 hex.");
    const bytes = await readFile(this.manifestPath(hash)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Config snapshot ${hash} is not available in the local content-addressed store.`);
      }
      throw error;
    });
    if (sha256(bytes) !== hash) throw new Error(`Config snapshot manifest ${hash} failed content verification.`);
    const manifest = JSON.parse(bytes.toString("utf8")) as ConfigSnapshotManifest;
    validateManifest(manifest);
    return { hash, manifest };
  }

  async materialize(snapshot: StoredConfigSnapshot, targetRoot: string): Promise<void> {
    for (const root of CONFIG_ROOTS) await rm(path.join(targetRoot, ...root.split("/")), { recursive: true, force: true });
    for (const entry of snapshot.manifest.files) {
      const target = safeSnapshotPath(targetRoot, entry.path);
      const blob = await readFile(this.blobPath(entry.contentHash));
      if (sha256(blob) !== entry.contentHash) {
        throw new Error(`Config snapshot blob ${entry.contentHash} failed verification.`);
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, blob, { mode: entry.mode });
      await chmod(target, entry.mode);
    }
  }

  private async storeBlob(hash: string, content: Buffer): Promise<void> {
    const target = this.blobPath(hash);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await writeFile(target, content, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(target);
      if (sha256(existing) !== hash) throw new Error(`Config snapshot blob collision at ${target}.`);
    }
  }

  private async storeManifest(hash: string, manifest: ConfigSnapshotManifest): Promise<void> {
    const target = this.manifestPath(hash);
    await mkdir(path.dirname(target), { recursive: true });
    const bytes = Buffer.from(JSON.stringify(manifest), "utf8");
    try {
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (sha256(await readFile(target)) !== hash) throw new Error(`Config snapshot manifest collision at ${target}.`);
    }
  }

  private blobPath(hash: string): string {
    return path.join(this.cacheRoot, "blobs", hash.slice(0, 2), hash);
  }

  private manifestPath(hash: string): string {
    return path.join(this.cacheRoot, "manifests", `${hash}.json`);
  }
}

const validateManifest = (manifest: ConfigSnapshotManifest): void => {
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error("Unsupported config snapshot manifest.");
  let previous = "";
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== "string" || !/^[0-9a-f]{64}$/i.test(entry.contentHash)) throw new Error("Invalid config snapshot entry.");
    if (entry.path <= previous) throw new Error("Config snapshot paths must be strictly sorted and unique.");
    safeSnapshotPath("/snapshot-root", entry.path);
    previous = entry.path;
  }
};

const safeSnapshotPath = (root: string, relativePath: string): string => {
  if (relativePath.includes("\\") || path.posix.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    throw new Error(`Unsafe config snapshot path: ${relativePath}`);
  }
  if (!CONFIG_ROOTS.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))) {
    throw new Error(`Config snapshot path is outside allowed roots: ${relativePath}`);
  }
  const target = path.resolve(root, ...relativePath.split("/"));
  const resolvedRoot = path.resolve(root);
  if (!target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Config snapshot path escaped its target: ${relativePath}`);
  return target;
};

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
