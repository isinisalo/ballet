import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const scanRoots = [
  "backend", "frontend", "shared",
  ".ballet/project.json", ".fixture-ballet-project/.ballet/project.json",
  "package.json", "vite.config.ts", "scripts"
];
const prohibited = [
  "reward" + "_mdp",
  "Reward" + "MDP",
  "Compiled" + "RewardPolicy",
  "policy" + "_decision",
  "policy" + "_observation",
  "acceptance" + "_ledger",
  "Project" + "Graph",
  "Project" + "GraphNode",
  "Project" + "ActionNode",
  "Graph" + "ExecutionPlanner",
  "GraphNode" + "Invocation",
  "ActionNode" + "Invocation",
  "graph_node" + "_invocations",
  "action_node" + "_invocations",
  "decision" + "-model",
  "graph-node" + "-module",
  "/automation/" + "graph",
  "rootKind: \"" + "graph\"",
  "rootKind: \"" + "graph_node\""
];
const transitionMarker = "v" + "next";
const self = path.resolve(import.meta.filename);

const files = (await Promise.all(scanRoots.map((entry) => collect(path.join(repositoryRoot, entry))))).flat();
const failures = [];
for (const filename of files) {
  if (filename === self) continue;
  const source = await readFile(filename, "utf8").catch(() => undefined);
  if (source === undefined) continue;
  const relative = path.relative(repositoryRoot, filename);
  for (const term of prohibited) {
    if (source.includes(term)) failures.push(`${relative}: prohibited term ${JSON.stringify(term)}`);
  }
  if (source.toLocaleLowerCase().includes(transitionMarker)) {
    failures.push(`${relative}: transition namespace marker remains`);
  }
  if (relative.toLocaleLowerCase().includes(transitionMarker)) {
    failures.push(`${relative}: transition path remains`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Strict cutover removal gate passed (${files.length - 1} files scanned).\n`);
}

async function collect(target) {
  const entries = await readdir(target, { withFileTypes: true }).catch(() => undefined);
  if (!entries) return [target];
  const nested = await Promise.all(entries
    .filter((entry) => !["node_modules", "dist", "dist-server"].includes(entry.name))
    .map((entry) => collect(path.join(target, entry.name))));
  return nested.flat();
}
