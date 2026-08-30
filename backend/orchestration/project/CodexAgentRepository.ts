import { randomUUID } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync
} from "node:fs";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import { governanceAgentDefinitionSchema } from "../../../shared/orchestration/schemas/environmentSchemas.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import type { GovernanceAgentDefinition, GovernanceAgentId } from "../../../shared/orchestration/environment.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export const GOVERNANCE_AGENT_IDS = ["ballet-critic-agent", "ballet-refinement-agent"] as const;

export type CodexAgentSlot = {
  id: GovernanceAgentId;
  relativePath: string;
  status: "ready" | "missing" | "invalid";
  contentHash?: string;
  source?: string;
  agent?: GovernanceAgentDefinition;
  error?: string;
};

export class CodexAgentRepository {
  constructor(private readonly projectRoot: string) {}

  list(): CodexAgentSlot[] { return GOVERNANCE_AGENT_IDS.map((id) => this.inspect(id)); }

  inspect(id: GovernanceAgentId): CodexAgentSlot {
    const relativePath = `.codex/agents/${id}.toml`;
    const filename = this.filename(id);
    const unsafeParent = firstUnsafeParent(this.projectRoot);
    if (unsafeParent) {
      return { id, relativePath, status: "invalid", error: `${unsafeParent} must be an ordinary directory.` };
    }
    const metadata = status(filename);
    if (!metadata) return { id, relativePath, status: "missing", error: `Restore ${relativePath} from Git.` };
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      return { id, relativePath, status: "invalid", error: `${relativePath} must be an ordinary file.` };
    }
    try {
      const { content, contentHash } = readOrdinaryFile(filename, relativePath);
      const value = parse(content);
      const agent = governanceAgentDefinitionSchema.parse({
        id,
        name: value.name,
        description: value.description,
        developerInstructions: value.developer_instructions,
        model: value.model,
        reasoningEffort: value.model_reasoning_effort,
        sandboxMode: value.sandbox_mode
      });
      return { id, relativePath, status: "ready", contentHash, source: content, agent };
    } catch (error) {
      return { id, relativePath, status: "invalid", error: error instanceof Error ? error.message : "Invalid Codex Agent TOML." };
    }
  }

  require(id: GovernanceAgentId): CodexAgentSlot & { status: "ready"; contentHash: string; source: string; agent: GovernanceAgentDefinition } {
    const slot = this.inspect(id);
    if (slot.status !== "ready" || !slot.agent || !slot.contentHash) throw new ConflictError(slot.error ?? `Agent ${id} is invalid.`);
    return slot as CodexAgentSlot & { status: "ready"; contentHash: string; source: string; agent: GovernanceAgentDefinition };
  }

  put(id: GovernanceAgentId, input: {
    developerInstructions: string;
    model: string;
    reasoningEffort: string;
    expectedHash: string;
  }): CodexAgentSlot & { status: "ready"; contentHash: string; source: string; agent: GovernanceAgentDefinition } {
    const current = this.require(id);
    if (current.contentHash !== input.expectedHash) throw new ConflictError(`Agent ${id} optimistic hash is stale.`);
    const content = stringify({
      name: id,
      description: current.agent.description,
      model: input.model,
      model_reasoning_effort: input.reasoningEffort,
      sandbox_mode: "read-only",
      developer_instructions: input.developerInstructions
    });
    atomicWrite(this.filename(id), `${content.trimEnd()}\n`);
    return this.require(id);
  }

  restore(id: GovernanceAgentId, source: string): void { atomicWrite(this.filename(id), source); }

  private filename(id: GovernanceAgentId): string {
    if (!GOVERNANCE_AGENT_IDS.includes(id)) throw new ConflictError(`Unknown governance Agent ${id}.`);
    return path.join(this.projectRoot, ".codex", "agents", `${id}.toml`);
  }
}

const readOrdinaryFile = (filename: string, label: string): { content: string; contentHash: string } => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) throw new ConflictError(`${label} must be an ordinary file.`);
    const content = readFileSync(descriptor, "utf8");
    return { content, contentHash: sha256(content) };
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
};

const status = (filename: string): ReturnType<typeof lstatSync> | undefined => {
  try { return lstatSync(filename); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
};

const atomicWrite = (filename: string, content: string): void => {
  const directory = path.dirname(filename);
  const metadata = status(directory);
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) throw new ConflictError(`${directory} must be an ordinary directory.`);
  const temporary = path.join(directory, `.${path.basename(filename)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    writeFileSync(descriptor, content, "utf8"); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
    renameSync(temporary, filename);
    const directoryDescriptor = openSync(directory, constants.O_RDONLY);
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (status(temporary)) unlinkSync(temporary);
  }
};

const firstUnsafeParent = (projectRoot: string): string | undefined => {
  for (const directory of [path.join(projectRoot, ".codex"), path.join(projectRoot, ".codex", "agents")]) {
    const metadata = status(directory);
    if (!metadata) continue;
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return path.relative(projectRoot, directory);
  }
  return undefined;
};
