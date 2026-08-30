import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const scanRoots = [
  "backend", "frontend", "shared",
  ".ballet/project.json", ".ballet/goals", ".ballet/adr", ".ballet/constraints",
  ".ballet/use-cases", ".ballet/instructions", ".ballet/releases", ".ballet/arc42",
  ".agents/skills", ".fixture-ballet-project/.ballet",
  "README.md", "ARCHITECTURE.md", "DESIGN.md", "AGENTS.md",
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
  "rootKind: \"" + "graph_node\"",
  "schemaVersion" + " = 15"
];
const transitionMarker = "v" + "next";
const replacedContractTerms = [
  "Product" + "Snapshot",
  "product" + "_snapshot",
  "Product " + "Snapshot",
  "Execution" + "Profile",
  "execution" + "Profile",
  "/" + "products",
  "/" + "run-evidence",
  "Local" + "RuntimeService",
  "Local" + "ProviderAdapter"
];
const daemonOnlyCliFlags = ["--codex-command"];
const localOnlyProhibited = [
  "device" + "Id",
  "runtime" + "BackendId",
  "/api/runtimes/" + "devices",
  "/api/" + "pairing",
  "ballet daemon " + "setup",
  "HttpWs" + "DaemonTransport",
  "DaemonWebSocket" + "Hub",
  "ControlPlane" + "Database",
  "ProjectConfigurationV" + "21",
  "projectConfigurationV" + "21Schema",
  "ExecutionPromptEvidenceV" + "12",
  "executionPromptEvidenceV" + "12Schema",
  "ExecutionSpecV" + "14",
  "executionSpecV" + "14Schema",
  "RootSnapshotV" + "15",
  "rootSnapshotV" + "15Schema",
  "RootSnapshotV" + "16",
  "rootSnapshotV" + "16Schema",
  "ActionRoleExecution" + "Binding",
  "actionRole" + "Binding",
  "putActionRole" + "Binding",
  "inspectAction" + "Role",
  "action_role_execution_" + "bindings",
  "useActionRoleExecution" + "Binding",
  "ExecutionSpecV" + "13",
  "RootSnapshotV" + "14",
  "ProjectConfigurationV" + "22",
  "projectConfigurationV" + "22Schema",
  "ExecutionSpecV" + "15",
  "executionSpecV" + "15Schema",
  "RootSnapshotV" + "17",
  "rootSnapshotV" + "17Schema",
  "AgentExecution" + "Binding",
  "agent_execution_" + "bindings",
  ".ballet/" + "agents",
  "readOnly" + "Roots"
  ,"ProjectConfigurationV" + "23"
  ,"projectConfigurationV" + "23Schema"
  ,"RootSnapshotV" + "18"
  ,"rootSnapshotV" + "18Schema"
  ,"ExecutionPromptEvidenceV" + "14"
  ,"executionPromptEvidenceV" + "14Schema"
  ,"ExecutionSpecV" + "16"
  ,"executionSpecV" + "16Schema"
  ,"ProjectConfigurationV" + "24"
  ,"projectConfigurationV" + "24Schema"
  ,"RootSnapshotV" + "19"
  ,"rootSnapshotV" + "19Schema"
  ,"ExecutionPromptEvidenceV" + "15"
  ,"executionPromptEvidenceV" + "15Schema"
  ,"ExecutionSpecV" + "17"
  ,"executionSpecV" + "17Schema"
  ,"ActionExecutionBindingV" + "3"
  ,"action_execution_" + "bindings"
  ,"useActionExecution" + "Binding"
  ,"instruction" + "Resource"
];
const self = path.resolve(import.meta.filename);

const files = (await Promise.all(scanRoots.map((entry) => collect(path.join(repositoryRoot, entry))))).flat();
const failures = [];
for (const filename of files) {
  if (filename === self) continue;
  const source = await readFile(filename, "utf8").catch(() => undefined);
  if (source === undefined) continue;
  const relative = path.relative(repositoryRoot, filename);
  for (const term of prohibited) {
    if (source.includes(term) && !allowedHistoricalMatch(relative, source)) {
      failures.push(`${relative}: prohibited term ${JSON.stringify(term)}`);
    }
  }
  for (const term of replacedContractTerms) {
    if (source.includes(term) && !allowedReplacementHistory(relative)) {
      failures.push(`${relative}: replaced contract term ${JSON.stringify(term)}`);
    }
  }
  for (const term of daemonOnlyCliFlags) {
    if (source.includes(term) && !allowedDaemonCliFlag(relative)) {
      failures.push(`${relative}: daemon-only CLI flag ${JSON.stringify(term)} leaked outside daemon setup`);
    }
  }
  for (const term of localOnlyProhibited) {
    if (source.includes(term) && !allowedLocalOnlyHistory(relative)) {
      failures.push(`${relative}: removed local-only contract term ${JSON.stringify(term)}`);
    }
  }
  if (source.toLocaleLowerCase().includes("copilot") && !allowedCodexOnlyHistory(relative)) {
    failures.push(`${relative}: removed Copilot capability remains`);
  }
  if (source.toLocaleLowerCase().includes(transitionMarker)
    && !allowedHistoricalMatch(relative, source)) {
    failures.push(`${relative}: transition namespace marker remains`);
  }
  if (relative.toLocaleLowerCase().includes(transitionMarker)) {
    failures.push(`${relative}: transition path remains`);
  }
}

function allowedReplacementHistory(relative) {
  return relative.startsWith(".ballet/adr/")
    || relative.startsWith(".ballet/goals/")
    || relative.startsWith(".ballet/arc42/")
    || relative === "frontend/tests/orchestrationRouting.test.ts";
}

function allowedDaemonCliFlag(relative) {
  return [
    "backend/cli/BalletCli.ts",
    "backend/cli/DaemonCliService.ts",
    "backend/cli/tests/cli.test.ts",
    "README.md"
  ].includes(relative);
}

function allowedLocalOnlyHistory(relative) {
  return relative.includes(".test.")
    || relative.startsWith(".ballet/")
    || ["README.md", "ARCHITECTURE.md", "DESIGN.md", "AGENTS.md"].includes(relative);
}

function allowedCodexOnlyHistory(relative) {
  return relative.includes(".test.")
    || relative.startsWith(".ballet/adr/")
    || relative.startsWith(".ballet/goals/")
    || relative.startsWith(".ballet/arc42/initiatives/");
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

function allowedHistoricalMatch(relative, source) {
  if (/^\.ballet\/(?:goals|adr)\/.+\.md$/.test(relative) && /^status:\s*superseded\s*$/m.test(source)) return true;
  if (relative.startsWith(".ballet/arc42/initiatives/")
    && !relative.startsWith(".ballet/arc42/initiatives/environment-state-action-orchestration/")) return true;
  if ([
    ".ballet/arc42/initiatives/environment-state-action-orchestration/AUDIT.md",
    ".ballet/arc42/initiatives/environment-state-action-orchestration/CUTOVER-MANIFEST.md",
    ".ballet/arc42/initiatives/environment-state-action-orchestration/EVIDENCE.md",
    ".ballet/arc42/initiatives/environment-state-action-orchestration/PLAN.md"
  ].includes(relative)) return true;
  if ([
    ".ballet/tests/defaultProjectResources.test.ts",
    ".ballet/tools/validate-arc42.mjs"
  ].includes(relative)) return true;
  return false;
}
