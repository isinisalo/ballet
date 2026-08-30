import { randomUUID } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync
} from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";
import type { ProjectDocumentKind } from "./ProjectReferenceIndex.js";

const COLLECTIONS: Record<ProjectDocumentKind, string> = {
  goal: "goals", adr: "adr", constraint: "constraints", "use-case": "use-cases",
  agent: "agents", instruction: "instructions", skill: "../.agents/skills"
};
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const SAFE_SKILL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127})*$/;

export interface ProjectDocument { kind: ProjectDocumentKind; id: string; content: string; contentHash: string }

/** Markdown authoring uses canonical project-local roots only. */
export class ProjectDocumentRepository {
  constructor(
    readonly dataRoot: string,
    private readonly connection?: () => Database.Database
  ) {}

  list(kind: ProjectDocumentKind): ProjectDocument[] {
    const directory = this.collectionPath(kind);
    const metadata = status(directory);
    if (!metadata) return [];
    assertOrdinaryDirectory(metadata, directory);
    const ids = kind === "skill"
      ? listSkillIds(directory)
      : readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md"))
        .map((entry) => documentId(path.join(directory, entry.name), entry.name.slice(0, -3)));
    return ids
      .map((id) => this.require(kind, id))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  require(kind: ProjectDocumentKind, id: string): ProjectDocument {
    const filename = this.filename(kind, id);
    const metadata = status(filename);
    if (!metadata) throw new NotFoundError(`${kind} ${id} was not found.`);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new ConflictError(`${kind} ${id} is not an ordinary file.`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!fstatSync(descriptor).isFile()) throw new ConflictError(`${kind} ${id} is not an ordinary file.`);
      const content = readFileSync(descriptor, "utf8");
      return { kind, id, content, contentHash: sha256(content) };
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  put(kind: ProjectDocumentKind, id: string, content: string, expectedHash: string | "absent"): ProjectDocument {
    if (!content.trim()) throw new ConflictError("Markdown content must not be empty.");
    const current = this.optional(kind, id);
    if ((current?.contentHash ?? "absent") !== expectedHash) throw new ConflictError(`${kind} ${id} optimistic hash is stale.`);
    if (current?.content !== content && this.isLocked(kind, id)) {
      throw new ConflictError(`${kind} ${id} is locked by an active immutable Run snapshot.`);
    }
    const directory = this.collectionPath(kind);
    ensureDirectory(this.dataRoot);
    ensureDirectory(directory);
    if (kind === "skill") ensureDirectory(path.join(directory, id));
    atomicWrite(this.filename(kind, id), content);
    return this.require(kind, id);
  }

  remove(kind: ProjectDocumentKind, id: string, expectedHash: string, blockers: string[]): void {
    const current = this.require(kind, id);
    if (current.contentHash !== expectedHash) throw new ConflictError(`${kind} ${id} optimistic hash is stale.`);
    if (blockers.length > 0) throw new ConflictError(`${kind} ${id} is referenced by ${blockers.join(", ")}.`);
    if (this.isLocked(kind, id)) throw new ConflictError(`${kind} ${id} is locked by an active immutable Run snapshot.`);
    unlinkSync(this.filename(kind, id));
    if (kind === "skill") rmdirSync(path.dirname(this.filename(kind, id)));
  }

  runReferences(kind: ProjectDocumentKind, id: string, activeOnly = false): string[] {
    if (!this.connection) return [];
    const rows = this.connection().prepare(`
      SELECT environment_run_id, execution_snapshot_json FROM environment_runs
      ${activeOnly ? "WHERE status IN ('pending','running')" : ""} ORDER BY environment_run_id
    `).all() as Array<{ environment_run_id: string; execution_snapshot_json: string }>;
    return rows.filter(({ execution_snapshot_json }) => snapshotContains(JSON.parse(execution_snapshot_json), kind, id))
      .map(({ environment_run_id }) => environment_run_id);
  }

  private optional(kind: ProjectDocumentKind, id: string): ProjectDocument | undefined {
    return status(this.filename(kind, id)) ? this.require(kind, id) : undefined;
  }

  private filename(kind: ProjectDocumentKind, id: string): string {
    if (!(kind === "skill" ? SAFE_SKILL_ID : SAFE_ID).test(id)) throw new ConflictError("Document id contains unsafe path characters.");
    const directory = this.collectionPath(kind);
    if (kind === "skill") return path.join(directory, ...id.split("/"), "SKILL.md");
    const matching = status(directory)?.isDirectory() ? readdirSync(directory, { withFileTypes: true })
      .find((entry) => entry.isFile() && entry.name.endsWith(".md")
        && documentId(path.join(directory, entry.name), entry.name.slice(0, -3)) === id) : undefined;
    return path.join(directory, matching?.name ?? `${id}.md`);
  }

  private collectionPath(kind: ProjectDocumentKind): string {
    return path.join(this.dataRoot, COLLECTIONS[kind]);
  }

  private isLocked(kind: ProjectDocumentKind, id: string): boolean {
    return this.runReferences(kind, id, true).length > 0;
  }
}

// eslint-disable-next-line complexity -- Every closed document kind maps to a distinct immutable snapshot collection.
const snapshotContains = (snapshot: unknown, kind: ProjectDocumentKind, id: string): boolean => {
  const value = snapshot as {
    direction?: { goals?: Array<{ id: string }>; adrs?: Array<{ id: string }>; constraints?: Array<{ id: string }> };
    approvedUseCases?: Array<{ useCase: { id: string } }>;
    resources?: Array<{ kind: string; id: string }>;
  };
  if (kind === "goal") return value.direction?.goals?.some((item) => item.id === id) ?? false;
  if (kind === "adr") return value.direction?.adrs?.some((item) => item.id === id) ?? false;
  if (kind === "constraint") return value.direction?.constraints?.some((item) => item.id === id) ?? false;
  if (kind === "use-case") return value.approvedUseCases?.some((item) => item.useCase.id === id) ?? false;
  if (kind === "agent") return (value as { agents?: Array<{ id: string }> }).agents?.some((item) => item.id === id) ?? false;
  return value.resources?.some((item) => item.kind === kind && item.id === id) ?? false;
};

const listSkillIds = (root: string, relative = ""): string[] => {
  const directory = relative ? path.join(root, ...relative.split("/")) : root;
  const entries = readdirSync(directory, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const id = relative ? `${relative}/${entry.name}` : entry.name;
    const skill = status(path.join(root, ...id.split("/"), "SKILL.md"));
    if (skill?.isFile() && !skill.isSymbolicLink()) ids.push(id);
    ids.push(...listSkillIds(root, id));
  }
  return ids;
};

const documentId = (filename: string, fallback: string): string => {
  const content = readFileSync(filename, "utf8");
  const match = content.match(/^---\s*$[\s\S]*?^id:\s*['"]?([^'"\s]+)['"]?\s*$/m);
  return match?.[1] ?? fallback;
};

const status = (filename: string): ReturnType<typeof lstatSync> | undefined => {
  try { return lstatSync(filename); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
};
const assertOrdinaryDirectory = (metadata: ReturnType<typeof lstatSync>, directory: string): void => {
  if (!metadata) throw new ConflictError(`${directory} does not exist.`);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new ConflictError(`${directory} must be an ordinary directory.`);
};
const ensureDirectory = (directory: string): void => {
  const parent = path.dirname(directory);
  const parentMetadata = status(parent);
  if (!parentMetadata?.isDirectory() || parentMetadata.isSymbolicLink()) throw new ConflictError(`${parent} must be an ordinary directory.`);
  const metadata = status(directory);
  if (!metadata) mkdirSync(directory, { mode: 0o700 });
  assertOrdinaryDirectory(status(directory)!, directory);
};
const atomicWrite = (filename: string, content: string): void => {
  const directory = path.dirname(filename);
  const temporary = path.join(directory, `.${path.basename(filename)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, content, "utf8"); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
    renameSync(temporary, filename);
    const directoryDescriptor = openSync(directory, "r");
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try { unlinkSync(temporary); } catch { /* Best effort only. */ }
    throw error;
  }
};
