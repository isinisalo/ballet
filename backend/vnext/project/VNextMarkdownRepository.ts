import { randomUUID } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync
} from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { sha256 } from "../../../shared/vnext/primitives.js";
import { VNextConflictError, VNextNotFoundError } from "../persistence/VNextErrors.js";
import type { VNextDocumentKind } from "./VNextReferenceIndex.js";

const COLLECTIONS: Record<VNextDocumentKind, string> = {
  goal: "goals", adr: "adrs", constraint: "constraints", "use-case": "use-cases",
  instruction: "instructions", skill: "skills"
};
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export interface VNextDocument { kind: VNextDocumentKind; id: string; content: string; contentHash: string }

/** Markdown authoring is isolated below an explicit vNext data root. */
export class VNextMarkdownRepository {
  constructor(
    readonly dataRoot: string,
    private readonly connection?: () => Database.Database
  ) {}

  list(kind: VNextDocumentKind): VNextDocument[] {
    const directory = this.collectionPath(kind);
    const metadata = status(directory);
    if (!metadata) return [];
    assertOrdinaryDirectory(metadata, directory);
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md"))
      .map((entry) => this.require(kind, entry.name.slice(0, -3)))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  require(kind: VNextDocumentKind, id: string): VNextDocument {
    const filename = this.filename(kind, id);
    const metadata = status(filename);
    if (!metadata) throw new VNextNotFoundError(`${kind} ${id} was not found.`);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new VNextConflictError(`${kind} ${id} is not an ordinary file.`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!fstatSync(descriptor).isFile()) throw new VNextConflictError(`${kind} ${id} is not an ordinary file.`);
      const content = readFileSync(descriptor, "utf8");
      return { kind, id, content, contentHash: sha256(content) };
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  put(kind: VNextDocumentKind, id: string, content: string, expectedHash: string | "absent"): VNextDocument {
    if (!content.trim()) throw new VNextConflictError("Markdown content must not be empty.");
    const current = this.optional(kind, id);
    if ((current?.contentHash ?? "absent") !== expectedHash) throw new VNextConflictError(`${kind} ${id} optimistic hash is stale.`);
    if (current?.content !== content && this.isLocked(kind, id)) {
      throw new VNextConflictError(`${kind} ${id} is locked by an active immutable Run snapshot.`);
    }
    const directory = this.collectionPath(kind);
    ensureDirectory(this.dataRoot);
    ensureDirectory(directory);
    atomicWrite(this.filename(kind, id), content);
    return this.require(kind, id);
  }

  remove(kind: VNextDocumentKind, id: string, expectedHash: string, blockers: string[]): void {
    const current = this.require(kind, id);
    if (current.contentHash !== expectedHash) throw new VNextConflictError(`${kind} ${id} optimistic hash is stale.`);
    if (blockers.length > 0) throw new VNextConflictError(`${kind} ${id} is referenced by ${blockers.join(", ")}.`);
    if (this.isLocked(kind, id)) throw new VNextConflictError(`${kind} ${id} is locked by an active immutable Run snapshot.`);
    unlinkSync(this.filename(kind, id));
  }

  runReferences(kind: VNextDocumentKind, id: string, activeOnly = false): string[] {
    if (!this.connection) return [];
    const rows = this.connection().prepare(`
      SELECT environment_run_id, execution_snapshot_json FROM environment_runs
      ${activeOnly ? "WHERE status IN ('pending','running')" : ""} ORDER BY environment_run_id
    `).all() as Array<{ environment_run_id: string; execution_snapshot_json: string }>;
    return rows.filter(({ execution_snapshot_json }) => snapshotContains(JSON.parse(execution_snapshot_json), kind, id))
      .map(({ environment_run_id }) => environment_run_id);
  }

  private optional(kind: VNextDocumentKind, id: string): VNextDocument | undefined {
    return status(this.filename(kind, id)) ? this.require(kind, id) : undefined;
  }

  private filename(kind: VNextDocumentKind, id: string): string {
    if (!SAFE_ID.test(id)) throw new VNextConflictError("Document id contains unsafe path characters.");
    return path.join(this.collectionPath(kind), `${id}.md`);
  }

  private collectionPath(kind: VNextDocumentKind): string {
    return path.join(this.dataRoot, COLLECTIONS[kind]);
  }

  private isLocked(kind: VNextDocumentKind, id: string): boolean {
    return this.runReferences(kind, id, true).length > 0;
  }
}

const snapshotContains = (snapshot: unknown, kind: VNextDocumentKind, id: string): boolean => {
  const value = snapshot as {
    direction?: { goals?: Array<{ id: string }>; adrs?: Array<{ id: string }>; constraints?: Array<{ id: string }> };
    approvedUseCases?: Array<{ useCase: { id: string } }>;
    resources?: Array<{ kind: string; id: string }>;
  };
  if (kind === "goal") return value.direction?.goals?.some((item) => item.id === id) ?? false;
  if (kind === "adr") return value.direction?.adrs?.some((item) => item.id === id) ?? false;
  if (kind === "constraint") return value.direction?.constraints?.some((item) => item.id === id) ?? false;
  if (kind === "use-case") return value.approvedUseCases?.some((item) => item.useCase.id === id) ?? false;
  return value.resources?.some((item) => item.kind === kind && item.id === id) ?? false;
};

const status = (filename: string): ReturnType<typeof lstatSync> | undefined => {
  try { return lstatSync(filename); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
};
const assertOrdinaryDirectory = (metadata: ReturnType<typeof lstatSync>, directory: string): void => {
  if (!metadata) throw new VNextConflictError(`${directory} does not exist.`);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new VNextConflictError(`${directory} must be an ordinary directory.`);
};
const ensureDirectory = (directory: string): void => {
  const parent = path.dirname(directory);
  const parentMetadata = status(parent);
  if (!parentMetadata?.isDirectory() || parentMetadata.isSymbolicLink()) throw new VNextConflictError(`${parent} must be an ordinary directory.`);
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
