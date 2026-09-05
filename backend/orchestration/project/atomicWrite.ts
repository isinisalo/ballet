import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ConflictError } from "../persistence/PersistenceErrors.js";

/** Replace a file durably after the repository has checked its path, hash and authoring lock. */
export function atomicWrite(filename: string, content: string): void {
  const directory = path.dirname(filename);
  const metadata = lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new ConflictError(`${directory} must be an ordinary directory.`);
  const temporary = path.join(directory, `.${path.basename(filename)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, content, "utf8");
    fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
    renameSync(temporary, filename);
    const directoryDescriptor = openSync(directory, "r");
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try { unlinkSync(temporary); } catch { /* Rename may already have completed. Preserve the original error. */ }
    throw error;
  }
}
