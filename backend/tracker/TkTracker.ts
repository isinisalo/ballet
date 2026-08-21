import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseDocument } from "yaml";
import type { ProjectIssueTrackerConfig } from "../../shared/domain/projectConfig.js";
import {
  tkTicketSchema as ticketSchema,
  type TkClaimInput, type TkStoreKind, type TkTicket, type TkUpsertInput
} from "./TkContracts.js";

export type { TkClaimInput, TkStoreKind, TkTicket, TkTicketType, TkUpsertInput } from "./TkContracts.js";

const execFileAsync = promisify(execFile);
const maxOutputBytes = 2 * 1024 * 1024;
const defaultTimeoutMs = 30_000;

export class TkTrackerError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "TkTrackerError";
  }
}

export class TkTracker {
  constructor(
    private readonly command = "tk",
    private readonly timeoutMs = defaultTimeoutMs
  ) {}

  async preflight(worktree: string, config: ProjectIssueTrackerConfig): Promise<void> {
    this.storeDirectory(worktree, config.orchestrationDirectory);
    this.storeDirectory(worktree, config.workDirectory);
    const temporary = await mkdtemp(path.join(os.tmpdir(), "ballet-tk-probe-"));
    const store = path.join(temporary, "tickets");
    try {
      await this.queryAt(temporary, store);
      const parentId = await this.createAt(temporary, store, {
        externalRef: "ballet-probe:root", title: "Ballet tk capability probe", type: "epic", priority: 4
      });
      const childId = await this.createAt(temporary, store, {
        externalRef: "ballet-probe:child", title: "Ballet tk child probe", type: "chore",
        priority: 4, parentId
      });
      await this.run(temporary, store, ["dep", childId, parentId]);
      await this.run(temporary, store, ["start", parentId]);
      await this.run(temporary, store, ["note", parentId, "Ballet capability probe"]);
      await this.run(temporary, store, ["close", parentId]);
      await this.run(temporary, store, ["ready", "--sort", "priority"]);
      await this.run(temporary, store, ["start", childId]);
      await this.run(temporary, store, ["close", childId]);
      await this.run(temporary, store, ["reopen", childId]);
      const tickets = await this.queryAt(temporary, store);
      if (tickets.length !== 2) throw new TkTrackerError("tk capability probe returned an unexpected ticket set.");
      await validateTkStore(store, tickets);
    } catch (error) {
      if (error instanceof TkTrackerError) throw error;
      throw new TkTrackerError(`tk capability probe failed: ${messageOf(error)}`, error);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  async query(worktree: string, config: ProjectIssueTrackerConfig, storeKind: TkStoreKind): Promise<TkTicket[]> {
    const store = this.configuredStore(worktree, config, storeKind);
    const tickets = await this.queryAt(worktree, store);
    await validateTkStore(store, tickets);
    return tickets;
  }

  async show(
    worktree: string,
    config: ProjectIssueTrackerConfig,
    storeKind: TkStoreKind,
    ticketId: string
  ): Promise<string> {
    const store = this.configuredStore(worktree, config, storeKind);
    const output = await this.run(worktree, store, ["show", ticketId]);
    await validateTkStore(store, await this.queryAt(worktree, store));
    return output;
  }

  async upsert(
    worktree: string,
    config: ProjectIssueTrackerConfig,
    storeKind: TkStoreKind,
    input: TkUpsertInput
  ): Promise<TkTicket> {
    const store = this.configuredStore(worktree, config, storeKind);
    const existing = await this.findExternalRef(worktree, store, input.externalRef);
    const ticketId = existing?.id ?? await this.createAt(worktree, store, input);
    for (const dependencyId of [...new Set(input.dependencyIds ?? [])].sort()) {
      if (dependencyId === ticketId) throw new TkTrackerError(`tk ticket ${ticketId} cannot depend on itself.`);
      await this.run(worktree, store, ["dep", ticketId, dependencyId]);
    }
    const tickets = await this.queryAt(worktree, store);
    await validateTkStore(store, tickets);
    const matches = tickets.filter((ticket) => ticket["external-ref"] === input.externalRef);
    if (matches.length !== 1) {
      throw new TkTrackerError(`tk external-ref ${input.externalRef} did not reconcile to exactly one ticket.`);
    }
    const reconciled = matches[0]!;
    if (input.parentId && reconciled.parent !== input.parentId) {
      throw new TkTrackerError(`tk external-ref ${input.externalRef} has parent ${reconciled.parent ?? "none"}; expected ${input.parentId}.`);
    }
    const missingDependencies = (input.dependencyIds ?? []).filter((dependency) => !reconciled.deps.includes(dependency));
    if (missingDependencies.length > 0) {
      throw new TkTrackerError(`tk external-ref ${input.externalRef} is missing dependencies: ${missingDependencies.join(", ")}.`);
    }
    return reconciled;
  }

  async start(worktree: string, config: ProjectIssueTrackerConfig, storeKind: TkStoreKind, ticketId: string) {
    return this.mutate(worktree, config, storeKind, ["start", ticketId]);
  }

  async note(
    worktree: string, config: ProjectIssueTrackerConfig, storeKind: TkStoreKind,
    ticketId: string, note: string
  ) {
    return this.mutate(worktree, config, storeKind, ["note", ticketId, note]);
  }

  async close(worktree: string, config: ProjectIssueTrackerConfig, storeKind: TkStoreKind, ticketId: string) {
    return this.mutate(worktree, config, storeKind, ["close", ticketId]);
  }

  async reopen(worktree: string, config: ProjectIssueTrackerConfig, storeKind: TkStoreKind, ticketId: string) {
    return this.mutate(worktree, config, storeKind, ["reopen", ticketId]);
  }

  async claim(worktree: string, config: ProjectIssueTrackerConfig, input: TkClaimInput): Promise<TkTicket | undefined> {
    const selected = (await this.ready(worktree, config, input.releaseTicketId))[0];
    if (!selected) return undefined;
    if (selected.status === "open") await this.start(worktree, config, "work", selected.id);
    return (await this.query(worktree, config, "work")).find((ticket) => ticket.id === selected.id);
  }

  async ready(
    worktree: string,
    config: ProjectIssueTrackerConfig,
    releaseTicketId?: string
  ): Promise<TkTicket[]> {
    const tickets = await this.query(worktree, config, "work");
    const unresolved = new Set(tickets.filter((ticket) => ticket.status !== "closed").map((ticket) => ticket.id));
    return tickets.filter((ticket) => ticket.status !== "closed"
      && (!releaseTicketId || ticket.parent === releaseTicketId)
      && ticket.deps.every((dependency) => !unresolved.has(dependency)))
      .sort(compareClaimCandidates);
  }

  private async mutate(
    worktree: string,
    config: ProjectIssueTrackerConfig,
    storeKind: TkStoreKind,
    args: string[]
  ): Promise<void> {
    const store = this.configuredStore(worktree, config, storeKind);
    await this.run(worktree, store, args);
    await validateTkStore(store, await this.queryAt(worktree, store));
  }

  private async findExternalRef(worktree: string, store: string, externalRef: string): Promise<TkTicket | undefined> {
    const matches = (await this.queryAt(worktree, store))
      .filter((ticket) => ticket["external-ref"] === externalRef);
    if (matches.length > 1) throw new TkTrackerError(`tk external-ref ${externalRef} is duplicated.`);
    return matches[0];
  }

  private async createAt(worktree: string, store: string, input: TkUpsertInput): Promise<string> {
    const priority = input.priority ?? 2;
    if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
      throw new TkTrackerError("tk priority must be an integer from 0 through 4.");
    }
    const args = [
      "new", input.title, "--type", input.type, "--priority", String(priority),
      "--external-ref", input.externalRef,
      ...(input.description ? ["--description", input.description] : []),
      ...(input.design ? ["--design", input.design] : []),
      ...(input.acceptance ? ["--acceptance", input.acceptance] : []),
      ...(input.parentId ? ["--parent", input.parentId] : [])
    ];
    const id = (await this.run(worktree, store, args)).trim();
    if (!/^[a-z0-9]+-[a-z0-9]+$/i.test(id)) throw new TkTrackerError("tk new returned an invalid ticket ID.");
    return id;
  }

  private async queryAt(worktree: string, store: string): Promise<TkTicket[]> {
    const output = await this.run(worktree, store, ["query"]);
    if (!output.trim()) return [];
    return output.trimEnd().split("\n").map((line, index) => {
      let value: unknown;
      try { value = JSON.parse(line); }
      catch (error) { throw new TkTrackerError(`tk query returned malformed JSONL at line ${index + 1}.`, error); }
      const parsed = ticketSchema.safeParse(value);
      if (!parsed.success) throw new TkTrackerError(`tk query returned an invalid ticket at line ${index + 1}.`);
      return { ...parsed.data, priority: Number(parsed.data.priority) };
    });
  }

  private configuredStore(worktree: string, config: ProjectIssueTrackerConfig, storeKind: TkStoreKind): string {
    return this.storeDirectory(
      worktree,
      storeKind === "orchestration" ? config.orchestrationDirectory : config.workDirectory
    );
  }

  private storeDirectory(worktree: string, relative: string): string {
    const root = path.resolve(worktree);
    const store = path.resolve(root, relative);
    if (!store.startsWith(`${root}${path.sep}`)) throw new TkTrackerError("tk store must be inside the Run worktree.");
    return store;
  }

  private async run(worktree: string, store: string, args: string[]): Promise<string> {
    this.storeDirectory(worktree, path.relative(worktree, store));
    try {
      const result = await execFileAsync(this.command, ["--dir", store, ...args], {
        cwd: path.resolve(worktree), encoding: "utf8", timeout: this.timeoutMs,
        maxBuffer: maxOutputBytes, windowsHide: true, shell: false
      });
      return result.stdout;
    } catch (error) {
      throw new TkTrackerError(`tk ${args[0] ?? "command"} failed: ${boundedProcessMessage(error)}`, error);
    }
  }
}

const validateTkStore = async (store: string, queried: readonly TkTicket[]): Promise<void> => {
  const entries = await readdir(store, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const markdown = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"));
  const parsed: TkTicket[] = [];
  for (const entry of markdown) {
    const content = await readFile(path.join(store, entry.name), "utf8");
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
    if (!match || !/^#\s+\S/m.test(content.slice(match[0].length))) {
      throw new TkTrackerError(`Malformed tk Markdown ticket: ${entry.name}.`);
    }
    const document = parseDocument(match[1]!, { uniqueKeys: true });
    if (document.errors.length > 0) throw new TkTrackerError(`Malformed tk YAML frontmatter: ${entry.name}.`);
    const value = ticketSchema.safeParse(document.toJS());
    if (!value.success) throw new TkTrackerError(`Invalid tk ticket frontmatter: ${entry.name}.`);
    if (`${value.data.id}.md` !== entry.name) throw new TkTrackerError(`tk ticket filename does not match id: ${entry.name}.`);
    parsed.push({ ...value.data, priority: Number(value.data.priority) });
  }
  if (parsed.length !== queried.length) throw new TkTrackerError("tk query omitted a malformed or unreadable Markdown ticket.");
  const byId = uniqueIndex(parsed, (ticket) => ticket.id, "ticket id");
  uniqueIndex(parsed.filter((ticket) => ticket["external-ref"]), (ticket) => ticket["external-ref"]!, "external-ref");
  for (const ticket of parsed) {
    for (const dependency of ticket.deps) {
      if (!byId.has(dependency)) throw new TkTrackerError(`tk ticket ${ticket.id} has dangling dependency ${dependency}.`);
    }
    if (ticket.parent && !byId.has(ticket.parent)) {
      throw new TkTrackerError(`tk ticket ${ticket.id} has dangling parent ${ticket.parent}.`);
    }
  }
  assertAcyclic(parsed, (ticket) => ticket.deps, "dependency");
  assertAcyclic(parsed, (ticket) => ticket.parent ? [ticket.parent] : [], "parent");
};

const uniqueIndex = <T>(values: readonly T[], key: (value: T) => string, label: string): Map<string, T> => {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new TkTrackerError(`Duplicate tk ${label}: ${id}.`);
    result.set(id, value);
  }
  return result;
};

const assertAcyclic = (
  tickets: readonly TkTicket[],
  successors: (ticket: TkTicket) => readonly string[],
  label: string
): void => {
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new TkTrackerError(`tk ${label} graph contains a cycle at ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    successors(byId.get(id)!).forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  tickets.forEach((ticket) => visit(ticket.id));
};

const compareClaimCandidates = (left: TkTicket, right: TkTicket): number => {
  if (left.status !== right.status) return left.status === "in_progress" ? -1 : 1;
  return left.priority - right.priority
    || left.created.localeCompare(right.created)
    || left.id.localeCompare(right.id);
};

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const boundedProcessMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return String(error).slice(0, 1_000);
  const source = error as { code?: unknown; killed?: unknown; stderr?: unknown; message?: unknown };
  if (source.killed) return "command timed out";
  const stderr = typeof source.stderr === "string" ? source.stderr.trim() : "";
  const message = stderr || (typeof source.message === "string" ? source.message : String(error));
  return message.slice(0, 1_000);
};
