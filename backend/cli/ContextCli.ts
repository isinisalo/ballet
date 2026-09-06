import { realpath } from "node:fs/promises";
import path from "node:path";
import { runGit } from "../execution/git/gitProcess.js";
import { EventStormingContextService } from "../orchestration/project/EventStormingContextService.js";
import { parseCliOptions } from "./CliOptions.js";

/** Deliberately bypass resolveProjectContext: context reads create no local runtime state. */
export async function runContextCommand(args: readonly string[], cwd: string): Promise<string> {
  if (args[0] !== "event-storming") throw new Error("Usage: ballet context event-storming [--process <id> | --story <id>] [--json]");
  const options = parseCliOptions(args.slice(1), new Set(["process", "story"]), new Set(["json"]));
  const root = await realpath((await runGit(["rev-parse", "--show-toplevel"], { cwd: path.resolve(cwd) })).stdout.trim());
  const value = new EventStormingContextService(root).read({ process: options.get("process"), story: options.get("story") });
  if (options.has("json")) return JSON.stringify(value, null, 2);
  if (value.kind === "index") return value.processes.map((p) => `${p.id}  ${p.title} (${p.stepCount} steps; ${p.storyIds.length} stories)`).join("\n") || "No Event Storming processes.";
  return JSON.stringify(value, null, 2);
}
