import { randomUUID } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, renameSync, unlinkSync, writeFileSync
} from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { ProjectConfigurationV20 } from "../../../shared/orchestration/environment.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import { projectConfigurationV20Schema } from "../../../shared/orchestration/schemas/environmentSchemas.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";

export interface LoadedProjectConfiguration {
  path: string;
  config: ProjectConfigurationV20;
  configHash: string;
}

/** Owns the single canonical Project Config v20 source. */
export class ProjectConfigurationRepository {
  constructor(
    readonly configPath: string,
    private readonly connection?: () => Database.Database
  ) {}

  load(): LoadedProjectConfiguration {
    const metadata = safeStatus(this.configPath);
    if (!metadata) throw new NotFoundError(`Project Config ${this.configPath} was not found.`);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new ConflictError("Project Config must be an ordinary file.");
    let descriptor: number | undefined;
    try {
      descriptor = openSync(this.configPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!fstatSync(descriptor).isFile()) throw new ConflictError("Project Config must be an ordinary file.");
      const value = JSON.parse(readFileSync(descriptor, "utf8")) as unknown;
      const config = projectConfigurationV20Schema.parse(value);
      return { path: this.configPath, config, configHash: configHash(config) };
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw new ConflictError(`Project Config v20 is required; Project Config v19 is unsupported and is not migrated: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  loadOptional(): LoadedProjectConfiguration | undefined {
    return safeStatus(this.configPath) ? this.load() : undefined;
  }

  save(config: ProjectConfigurationV20, expectedHash: string | "absent"): LoadedProjectConfiguration {
    const result = projectConfigurationV20Schema.safeParse(config);
    if (!result.success) {
      throw new ConflictError(`Project Config v20 is invalid: ${result.error.issues.map(({ path: issuePath, message }) => `${issuePath.join(".")}: ${message}`).join("; ")}`);
    }
    const parsed = result.data;
    const current = this.loadOptional();
    if ((current?.configHash ?? "absent") !== expectedHash) {
      throw new ConflictError("Project Config optimistic hash is stale.");
    }
    if (current && current.configHash !== configHash(parsed) && this.hasActiveRun()) {
      throw new ConflictError("Project Config is locked while an Environment Run is active.");
    }
    ensureOrdinaryDirectory(path.dirname(this.configPath));
    writeAtomic(this.configPath, `${canonicalProject(parsed)}\n`);
    return this.load();
  }

  private hasActiveRun(): boolean {
    if (!this.connection) return false;
    const row = this.connection().prepare(
      "SELECT 1 FROM environment_runs WHERE status IN ('pending','running') LIMIT 1"
    ).get();
    return Boolean(row);
  }
}

export const configHash = (config: ProjectConfigurationV20): string =>
  sha256(canonicalProject(config));

const canonicalProject = (config: ProjectConfigurationV20): string =>
  canonicalJson(JSON.parse(JSON.stringify(config)) as JsonValue);

const safeStatus = (filename: string): ReturnType<typeof lstatSync> | undefined => {
  try { return lstatSync(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const ensureOrdinaryDirectory = (directory: string): void => {
  const parent = path.dirname(directory);
  const parentStatus = safeStatus(parent);
  if (!parentStatus?.isDirectory() || parentStatus.isSymbolicLink()) {
    throw new ConflictError("Project Config parent must be an ordinary directory.");
  }
  const metadata = safeStatus(directory);
  if (!metadata) mkdirSync(directory, { mode: 0o700 });
  const created = safeStatus(directory);
  if (!created?.isDirectory() || created.isSymbolicLink()) {
    throw new ConflictError("Project Config directory must not be a symlink.");
  }
};

const writeAtomic = (filename: string, source: string): void => {
  const directory = path.dirname(filename);
  const temporary = path.join(directory, `.${path.basename(filename)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, source, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, filename);
    const directoryDescriptor = openSync(directory, "r");
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try { unlinkSync(temporary); } catch { /* Rename may already have completed. */ }
    throw error;
  }
};
