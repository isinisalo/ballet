import { randomUUID } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, readdirSync,
  renameSync, unlinkSync, writeFileSync
} from "node:fs";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import { actionAgentDefinitionSchema, governanceAgentDefinitionSchema } from "../../../shared/orchestration/schemas/environmentSchemas.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import type { ActionAgentDefinition, GovernanceAgentDefinition, GovernanceAgentId } from "../../../shared/orchestration/environment.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export const GOVERNANCE_AGENT_IDS = ["ballet-critic-agent", "ballet-refinement-agent"] as const;
const ACTION_AGENT_PATTERN = /^ballet-action-(?:validation|work)-[a-z0-9][a-z0-9-]*$/;
const ACTION_FIELDS = ["name", "description", "developer_instructions", "model", "model_reasoning_effort"] as const;
const GOVERNANCE_FIELDS = [...ACTION_FIELDS, "sandbox_mode"] as const;

export type CodexAgentSlot<T extends GovernanceAgentDefinition | ActionAgentDefinition> = {
  id: T["id"]; relativePath: string; status: "ready" | "missing" | "invalid";
  contentHash?: string; source?: string; agent?: T; error?: string;
};
type ReadySlot<T extends GovernanceAgentDefinition | ActionAgentDefinition> = CodexAgentSlot<T> & {
  status: "ready"; contentHash: string; source: string; agent: T;
};

export class CodexAgentRepository {
  constructor(private readonly projectRoot: string) {}

  list(): CodexAgentSlot<GovernanceAgentDefinition>[] { return GOVERNANCE_AGENT_IDS.map((id) => this.inspect(id)); }

  inspect(id: GovernanceAgentId): CodexAgentSlot<GovernanceAgentDefinition> {
    return this.inspectFile(id, GOVERNANCE_FIELDS, (value) => governanceAgentDefinitionSchema.parse({
      id, name: value.name, description: value.description, developerInstructions: value.developer_instructions,
      model: value.model, reasoningEffort: value.model_reasoning_effort, sandboxMode: value.sandbox_mode
    }));
  }
  require(id: GovernanceAgentId): ReadySlot<GovernanceAgentDefinition> {
    return requireReady(this.inspect(id), `Agent ${id} is invalid.`);
  }

  inspectAction(id: string): CodexAgentSlot<ActionAgentDefinition> {
    if (!ACTION_AGENT_PATTERN.test(id)) throw new ConflictError(`Invalid Action Agent id ${id}.`);
    return this.inspectFile(id, ACTION_FIELDS, (value) => actionAgentDefinitionSchema.parse({
      id, name: value.name, description: value.description, developerInstructions: value.developer_instructions,
      model: value.model, reasoningEffort: value.model_reasoning_effort
    }));
  }
  requireAction(id: string): ReadySlot<ActionAgentDefinition> {
    return requireReady(this.inspectAction(id), `Action Agent ${id} is invalid.`);
  }
  requireActionSet(ids: string[]): ReadySlot<ActionAgentDefinition>[] {
    const expected = [...new Set(ids)].sort(); const actual = this.actionAgentFileIds();
    const missing = expected.filter((id) => !actual.includes(id)); const extra = actual.filter((id) => !expected.includes(id));
    if (missing.length || extra.length) throw new ConflictError(`Action Agent inventory differs.${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}${extra.length ? ` Extra: ${extra.join(", ")}.` : ""}`);
    const slots = expected.map((id) => this.requireAction(id));
    const instructions = slots.map(({ agent }) => agent.developerInstructions);
    if (new Set(instructions).size !== instructions.length) throw new ConflictError("Every Action Agent must have unique developer instructions.");
    return slots;
  }

  put(id: GovernanceAgentId, input: { developerInstructions: string; model: string; reasoningEffort: string; expectedHash: string }): ReadySlot<GovernanceAgentDefinition> {
    const current = this.require(id); if (current.contentHash !== input.expectedHash) throw stale(id);
    this.write(id, { name: id, description: current.agent.description, model: input.model,
      model_reasoning_effort: input.reasoningEffort, sandbox_mode: "read-only", developer_instructions: input.developerInstructions });
    return this.require(id);
  }
  putAction(id: string, input: { description: string; developerInstructions: string; model: string; reasoningEffort: string; expectedHash: string | "absent" }): ReadySlot<ActionAgentDefinition> {
    const current = this.inspectAction(id);
    if (input.expectedHash === "absent") {
      if (current.status !== "missing") throw new ConflictError(`Action Agent ${id} already exists.`);
    } else if (current.status !== "ready" || current.contentHash !== input.expectedHash) throw stale(id);
    this.write(id, { name: id, description: input.description, developer_instructions: input.developerInstructions,
      model: input.model, model_reasoning_effort: input.reasoningEffort });
    return this.requireAction(id);
  }
  removeAction(id: string, expectedHash: string): string {
    const current = this.requireAction(id); if (current.contentHash !== expectedHash) throw stale(id);
    unlinkSync(this.filename(id)); return current.source;
  }
  restore(id: string, source: string): void { atomicWrite(this.filename(id), source); }

  private inspectFile<T extends GovernanceAgentDefinition | ActionAgentDefinition>(id: T["id"], fields: readonly string[], decode: (value: Record<string, unknown>) => T): CodexAgentSlot<T> {
    const relativePath = `.codex/agents/${id}.toml`; const filename = this.filename(id); const unsafeParent = firstUnsafeParent(this.projectRoot);
    if (unsafeParent) return { id, relativePath, status: "invalid", error: `${unsafeParent} must be an ordinary directory.` };
    const metadata = status(filename);
    if (!metadata) return { id, relativePath, status: "missing", error: `Restore ${relativePath} from Git.` };
    if (!metadata.isFile() || metadata.isSymbolicLink()) return { id, relativePath, status: "invalid", error: `${relativePath} must be an ordinary file.` };
    try {
      const { content, contentHash } = readOrdinaryFile(filename, relativePath); const value = parse(content) as Record<string, unknown>;
      const keys = Object.keys(value).sort(); const expected = [...fields].sort();
      if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new ConflictError(`${relativePath} must contain exactly ${expected.join(", ")}.`);
      return { id, relativePath, status: "ready", contentHash, source: content, agent: decode(value) };
    } catch (error) { return { id, relativePath, status: "invalid", error: error instanceof Error ? error.message : "Invalid Codex Agent TOML." }; }
  }
  private actionAgentFileIds(): string[] {
    return readdirSync(path.join(this.projectRoot, ".codex", "agents")).filter((name) => name.endsWith(".toml"))
      .map((name) => name.slice(0, -5)).filter((id) => id.startsWith("ballet-action-")).sort();
  }
  private write(id: string, value: Record<string, unknown>): void { atomicWrite(this.filename(id), `${stringify(value).trimEnd()}\n`); }
  private filename(id: string): string {
    if (![...GOVERNANCE_AGENT_IDS].includes(id as GovernanceAgentId) && !ACTION_AGENT_PATTERN.test(id)) throw new ConflictError(`Unknown Codex Agent ${id}.`);
    return path.join(this.projectRoot, ".codex", "agents", `${id}.toml`);
  }
}

const requireReady = <T extends GovernanceAgentDefinition | ActionAgentDefinition>(slot: CodexAgentSlot<T>, message: string): ReadySlot<T> => {
  if (slot.status !== "ready" || !slot.agent || !slot.contentHash || slot.source === undefined) throw new ConflictError(slot.error ?? message);
  return slot as ReadySlot<T>;
};
const stale = (id: string): ConflictError => new ConflictError(`Agent ${id} optimistic hash is stale.`);
const readOrdinaryFile = (filename: string, label: string): { content: string; contentHash: string } => {
  let descriptor: number | undefined;
  try { descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW); if (!fstatSync(descriptor).isFile()) throw new ConflictError(`${label} must be an ordinary file.`);
    const content = readFileSync(descriptor, "utf8"); return { content, contentHash: sha256(content) }; }
  finally { if (descriptor !== undefined) closeSync(descriptor); }
};
const status = (filename: string): ReturnType<typeof lstatSync> | undefined => {
  try { return lstatSync(filename); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
};
const atomicWrite = (filename: string, content: string): void => {
  const directory = path.dirname(filename); const metadata = status(directory);
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) throw new ConflictError(`${directory} must be an ordinary directory.`);
  const temporary = path.join(directory, `.${path.basename(filename)}.${randomUUID()}.tmp`); let descriptor: number | undefined;
  try { descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); writeFileSync(descriptor, content, "utf8"); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
    renameSync(temporary, filename); const directoryDescriptor = openSync(directory, constants.O_RDONLY); try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); } }
  finally { if (descriptor !== undefined) closeSync(descriptor); if (status(temporary)) unlinkSync(temporary); }
};
const firstUnsafeParent = (projectRoot: string): string | undefined => {
  for (const directory of [path.join(projectRoot, ".codex"), path.join(projectRoot, ".codex", "agents")]) {
    const metadata = status(directory); if (!metadata) continue; if (!metadata.isDirectory() || metadata.isSymbolicLink()) return path.relative(projectRoot, directory);
  }
  return undefined;
};
