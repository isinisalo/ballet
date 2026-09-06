import { atomicWrite } from "./atomicWrite.js";
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync,
  openSync, readFileSync
} from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { ProjectConfigurationV26 } from "../../../shared/orchestration/environment.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import { projectConfigurationV26Schema } from "../../../shared/orchestration/schemas/environmentSchemas.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";

export interface LoadedProjectConfiguration {
  path: string;
  config: ProjectConfigurationV26;
  configHash: string;
}

/** Owns the single canonical Project Config v26 source. */
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
      const config = projectConfigurationV26Schema.parse(value);
      return { path: this.configPath, config, configHash: configHash(config) };
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw new ConflictError(`Project Config v26 is required; earlier Project Config versions are unsupported and are not migrated: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  loadOptional(): LoadedProjectConfiguration | undefined {
    return safeStatus(this.configPath) ? this.load() : undefined;
  }

  save(config: ProjectConfigurationV26, expectedHash: string | "absent"): LoadedProjectConfiguration {
    const result = projectConfigurationV26Schema.safeParse(config);
    if (!result.success) {
      throw new ConflictError(`Project Config v26 is invalid: ${result.error.issues.map(({ path: issuePath, message }) => `${issuePath.join(".")}: ${message}`).join("; ")}`);
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
    atomicWrite(this.configPath, `${canonicalProject(parsed)}\n`);
    return this.load();
  }

  assertUnlocked(): void {
    if (this.hasActiveRun()) throw new ConflictError("Project Config is locked while an Environment Run is active.");
  }

  private hasActiveRun(): boolean {
    if (!this.connection) return false;
    const row = this.connection().prepare(
      "SELECT 1 FROM environment_runs WHERE status IN ('pending','running') LIMIT 1"
    ).get();
    return Boolean(row);
  }
}

export const configHash = (config: ProjectConfigurationV26): string =>
  sha256(canonicalProject(config));

const canonicalProject = (config: ProjectConfigurationV26): string =>
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
