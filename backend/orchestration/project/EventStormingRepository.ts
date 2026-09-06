import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { EVENT_STORMING_LIMITS, serializeStormJson } from "../../../shared/orchestration/eventStorming.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import { atomicWrite } from "./atomicWrite.js";

/** Fixed Git-owned JSON files. No config, SQLite, daemon or runtime initialization. */
export class EventStormingRepository {
  constructor(readonly dataRoot: string) {}
  read(name: "model" | "layout"): { content: string; contentHash: string } | undefined {
    const content = readProjectSource(path.dirname(this.dataRoot), `.ballet/event-storming/${name}.json`);
    return content === undefined ? undefined : { content, contentHash: sha256(content) };
  }
  put(name: "model" | "layout", value: unknown, expectedHash: string): void {
    const content = serializeStormJson(value);
    if (Buffer.byteLength(content) > EVENT_STORMING_LIMITS.documentBytes) throw new ConflictError("Event Storming exceeds the document size limit.");
    const current = this.read(name);
    if ((current?.contentHash ?? "absent") !== expectedHash) throw new ConflictError(`Event Storming ${name} optimistic hash is stale; current hash: ${current?.contentHash ?? "absent"}.`);
    for (const directory of [this.dataRoot, path.join(this.dataRoot, "event-storming")]) {
      try { mkdirSync(directory, { mode: 0o700 }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      const stat = lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ConflictError(`${directory} must be an ordinary directory.`);
    }
    atomicWrite(path.join(this.dataRoot, "event-storming", `${name}.json`), content);
  }
}

/** Validate every ancestor before opening; unavailable evidence never escapes the checkout. */
export function readProjectSource(root: string, source: string): string | undefined {
  const relative = source.split("#")[0];
  if (!relative.startsWith(".ballet/") || relative.includes("\\") || relative.split("/").some((s) => s === ".." || !s)) throw new ConflictError("Unsafe project source path.");
  const parts = relative.split("/");
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new ConflictError(`${relative} must be an ordinary file with ordinary directory ancestors.`);
  }
  const fd = openSync(current, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > EVENT_STORMING_LIMITS.documentBytes) throw new ConflictError(`Invalid or oversized source ${relative}.`);
    return readFileSync(fd, "utf8");
  } finally { closeSync(fd); }
}
