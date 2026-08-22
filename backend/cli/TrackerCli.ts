import type { ProjectIssueTrackerConfig } from "../../shared/domain/projectConfig.js";
import { LocalSettingsRepository } from "../execution/LocalSettingsRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import { TkTracker, type TkTicketType } from "../tracker/TkTracker.js";

interface TrackerCliContext {
  project: ProjectContext;
  tracker: TkTracker;
  config: ProjectIssueTrackerConfig;
  write: (message: string) => void;
}

type TrackerAction = (args: readonly string[], context: TrackerCliContext) => Promise<void>;

export const runTrackerCli = async (
  args: readonly string[],
  project: ProjectContext,
  write: (message: string) => void
): Promise<void> => {
  const action = args[0];
  if (!action) throw new Error(trackerUsage);
  const loaded = new ProjectConfigurationRepository().load(project.root);
  if (!loaded.config || loaded.issues.length > 0) {
    const issue = loaded.issues[0];
    throw new Error(issue
      ? `Project configuration is invalid at ${issue.path}: ${issue.message}`
      : "Project has no strict v14 configuration.");
  }
  const settings = await new LocalSettingsRepository(project.settingsPath).load();
  const handler = trackerActions[action];
  if (!handler) throw new Error(`Unknown tracker action: ${action}\n${trackerUsage}`);
  await handler(args.slice(1), {
    project,
    tracker: new TkTracker(settings.tkCommand ?? "tk"),
    config: loaded.config.issueTracker,
    write
  });
};

const trackerActions: Readonly<Record<string, TrackerAction>> = {
  query: queryTickets,
  ready: readyTickets,
  claim: claimTicket,
  upsert: upsertTicket,
  start: (args, context) => mutateTicket("start", args, context),
  close: (args, context) => mutateTicket("close", args, context),
  reopen: (args, context) => mutateTicket("reopen", args, context),
  note: noteTicket
};

async function queryTickets(args: readonly string[], context: TrackerCliContext): Promise<void> {
  requireCount(args, 0, "ballet tracker query");
  for (const ticket of await context.tracker.query(context.project.root, context.config, "work")) {
    context.write(JSON.stringify(ticket));
  }
}

async function readyTickets(args: readonly string[], context: TrackerCliContext): Promise<void> {
  const options = parseOptions(args, new Set(["release"]));
  for (const ticket of await context.tracker.ready(context.project.root, context.config, options.get("release"))) {
    context.write(JSON.stringify(ticket));
  }
}

async function claimTicket(args: readonly string[], context: TrackerCliContext): Promise<void> {
  const options = parseOptions(args, new Set(["release"]));
  const ticket = await context.tracker.claim(context.project.root, context.config, {
    releaseTicketId: required(options, "release")
  });
  if (ticket) context.write(JSON.stringify(ticket));
}

async function upsertTicket(args: readonly string[], context: TrackerCliContext): Promise<void> {
  const options = parseOptions(args, new Set([
    "external-ref", "title", "type", "priority", "description", "design", "acceptance", "parent", "depends-on"
  ]));
  const rawType = required(options, "type");
  if (!(validTicketTypes as readonly string[]).includes(rawType)) {
    throw new Error("--type must be bug, feature, task, epic, or chore.");
  }
  const rawPriority = options.get("priority");
  const ticket = await context.tracker.upsert(context.project.root, context.config, "work", {
    externalRef: required(options, "external-ref"),
    title: required(options, "title"),
    type: rawType as TkTicketType,
    ...(rawPriority === undefined ? {} : { priority: Number(rawPriority) }),
    ...optionalField(options, "description", "description"),
    ...optionalField(options, "design", "design"),
    ...optionalField(options, "acceptance", "acceptance"),
    ...optionalField(options, "parent", "parentId"),
    ...(options.has("depends-on") ? { dependencyIds: dependencyIds(options.get("depends-on")!) } : {})
  });
  context.write(JSON.stringify(ticket));
}

async function mutateTicket(
  action: "start" | "close" | "reopen",
  args: readonly string[],
  context: TrackerCliContext
): Promise<void> {
  requireCount(args, 1, `ballet tracker ${action} <ticket-id>`);
  await context.tracker[action](context.project.root, context.config, "work", args[0]!);
}

async function noteTicket(args: readonly string[], context: TrackerCliContext): Promise<void> {
  if (args.length < 2) throw new Error("Usage: ballet tracker note <ticket-id> <note>");
  await context.tracker.note(context.project.root, context.config, "work", args[0]!, args.slice(1).join(" "));
}

const parseOptions = (args: readonly string[], allowed: ReadonlySet<string>): Map<string, string> => {
  const result = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) throw new Error(`Unexpected tracker argument: ${argument}`);
    const separator = argument.indexOf("=");
    const key = argument.slice(2, separator < 0 ? undefined : separator);
    if (!allowed.has(key) || result.has(key)) throw new Error(`Invalid or repeated tracker option: --${key}`);
    const value = separator < 0 ? args[++index] : argument.slice(separator + 1);
    if (!value || value.startsWith("--")) throw new Error(`--${key} requires a value.`);
    result.set(key, value);
  }
  return result;
};

const optionalField = <K extends string>(
  values: ReadonlyMap<string, string>, option: string, property: K
): Partial<Record<K, string>> => {
  const value = values.get(option);
  return value ? { [property]: value } as Partial<Record<K, string>> : {};
};

const required = (values: ReadonlyMap<string, string>, key: string): string => {
  const value = values.get(key);
  if (!value) throw new Error(`--${key} is required.`);
  return value;
};

const requireCount = (args: readonly string[], count: number, usage: string) => {
  if (args.length !== count) throw new Error(`Usage: ${usage}`);
};

const dependencyIds = (value: string): string[] => {
  const result = value.split(",").map((id) => id.trim());
  if (result.some((id) => !id) || new Set(result).size !== result.length) {
    throw new Error("--depends-on must be a comma-separated list of unique ticket IDs.");
  }
  return result;
};

const validTicketTypes = ["bug", "feature", "task", "epic", "chore"] as const;

export const trackerUsage = `Agent work issue commands:
  ballet tracker query
  ballet tracker ready [--release <epic-id>]
  ballet tracker claim --release <epic-id>
  ballet tracker upsert --external-ref <ref> --title <title> --type <type> [--parent <id>] [--depends-on <id,id>] [options]
  ballet tracker start|close|reopen <ticket-id>
  ballet tracker note <ticket-id> <note>`;
