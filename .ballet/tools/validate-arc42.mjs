import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.ts";
import {
  validateProjectAutomationConfig,
  validateProjectExecutionResources
} from "../../backend/automation/validateAutomationConfig.ts";
import { loadProjectResources } from "../../backend/documents/projectResourceCatalog.ts";

const root = process.cwd();
const arc42Root = path.join(root, ".ballet/arc42");
const issues = [];
const allowedStatuses = new Set(["draft", "review", "accepted", "superseded"]);
const sections = [
  "01-introduction-and-goals.md", "02-constraints.md", "03-context-and-scope.md",
  "04-solution-strategy.md", "05-building-block-view.md", "06-runtime-view.md",
  "07-deployment-view.md", "08-crosscutting-concepts.md", "09-architecture-decisions.md",
  "10-quality-requirements.md", "11-risks-and-technical-debt.md", "12-glossary.md"
];
const required = [
  "ARCHITECTURE.md", ".ballet/arc42/README.md", ".ballet/arc42/STATUS.md",
  ".ballet/arc42/TRACEABILITY.md", ".ballet/arc42/METHOD-HEALTH.md",
  ".ballet/arc42/STATE-CONTRACT.md", ".ballet/arc42/migration/ASSESSMENT.md",
  ".ballet/arc42/migration/CONTENT-MAP.md", ".ballet/arc42/migration/DECISIONS.md",
  ...["BRIEF.md", "PLAN.md", "EVIDENCE.md", "REVIEW.md"].flatMap((name) => [
    `.ballet/arc42/initiatives/TEMPLATE/${name}`,
    `.ballet/arc42/initiatives/graph-reward-mdp/${name}`
  ]),
  ...sections.map((name) => `.ballet/arc42/${name}`)
];
const expectedGraphNodeIds = ["design", "plan", "build", "deploy", "verify"];
const expectedDesignJobs = [
  "design-01-introduction-and-goals", "design-02-constraints", "design-03-context-and-scope",
  "design-04-solution-strategy", "design-05-building-block-view", "design-06-runtime-view",
  "design-07-deployment-view", "design-08-crosscutting-concepts", "design-09-architecture-decisions",
  "design-10-quality-requirements", "design-11-risks-and-technical-debt", "design-12-glossary"
];
const expectedVersions = {
  project: 18,
  decisionModel: 3,
  capabilityModel: 3
};

const addIssue = (message) => issues.push(message);
const rel = (absolute) => path.relative(root, absolute).split(path.sep).join("/");
const exists = async (absolute) => stat(absolute).then(() => true, () => false);
const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }))).flat();
};
const parseMarkdown = async (absolute) => {
  const source = await readFile(absolute, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { source, body: source, frontmatter: null };
  try {
    return { source, body: source.slice(match[0].length), frontmatter: YAML.parse(match[1]) };
  } catch (error) {
    addIssue(`${rel(absolute)}: invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
    return { source, body: source.slice(match[0].length), frontmatter: null };
  }
};
const markerBlock = (source, name) => source.match(
  new RegExp(`<!-- ${name}:start -->([\\s\\S]*?)<!-- ${name}:end -->`)
)?.[1] ?? "";
const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const headingAnchors = (body) => {
  const counts = new Map();
  const anchors = new Set();
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1];
    if (!heading) continue;
    const base = heading.toLowerCase().replace(/`([^`]*)`/g, "$1").replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  return anchors;
};

for (const filename of required) if (!(await exists(path.join(root, filename)))) addIssue(`Missing required artifact: ${filename}`);

const markdownFiles = [
  path.join(root, "ARCHITECTURE.md"),
  ...(await walk(arc42Root)).filter((file) => file.endsWith(".md"))
];
const docs = new Map();
const ids = new Map();
for (const file of markdownFiles) {
  const doc = await parseMarkdown(file);
  docs.set(file, doc);
  const fm = doc.frontmatter;
  if (!fm || typeof fm !== "object") { addIssue(`${rel(file)}: frontmatter is required.`); continue; }
  for (const field of ["id", "title", "status", "createdAt", "updatedAt", "version", "tags"]) {
    if (fm[field] === undefined || fm[field] === null || fm[field] === "") addIssue(`${rel(file)}: missing ${field}.`);
  }
  if (!allowedStatuses.has(fm.status)) addIssue(`${rel(file)}: invalid status ${String(fm.status)}.`);
  if (!Array.isArray(fm.tags)) addIssue(`${rel(file)}: tags must be an array.`);
  if (typeof fm.id === "string") {
    if (ids.has(fm.id)) addIssue(`Duplicate document ID ${fm.id}: ${ids.get(fm.id)} and ${rel(file)}.`);
    else ids.set(fm.id, rel(file));
  }
}

for (const [index, filename] of sections.entries()) {
  const file = path.join(arc42Root, filename);
  if (docs.get(file)?.frontmatter?.arc42Section !== index + 1) addIssue(`${rel(file)}: arc42Section must be ${index + 1}.`);
}

for (const [file, doc] of docs) {
  const links = [...doc.body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
  for (const raw of links) {
    const target = raw.replace(/^<|>$/g, "").split(/\s+["']/)[0];
    if (/^(?:https?:|mailto:|app:)/.test(target)) continue;
    const [pathPart, rawAnchor] = target.split("#", 2);
    const linked = pathPart ? path.resolve(path.dirname(file), decodeURIComponent(pathPart)) : file;
    if (!(await exists(linked))) { addIssue(`${rel(file)}: broken local link ${raw}.`); continue; }
    if (rawAnchor && linked.endsWith(".md")) {
      const linkedDoc = docs.get(linked) ?? await parseMarkdown(linked);
      if (!headingAnchors(linkedDoc.body).has(decodeURIComponent(rawAnchor).toLowerCase())) {
        addIssue(`${rel(file)}: unresolved anchor ${raw}.`);
      }
    }
  }
}

const qualityFile = path.join(arc42Root, "10-quality-requirements.md");
const qualityLines = markerBlock(docs.get(qualityFile)?.source ?? "", "quality-scenarios")
  .split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
const qualityHeaders = [
  "ID", "Source", "Stimulus", "Environment", "Affected artifact", "Expected response",
  "Measurable response criterion", "Priority", "Evidence", "Status"
];
if (JSON.stringify(splitRow(qualityLines[0] ?? "")) !== JSON.stringify(qualityHeaders)) {
  addIssue("Section 10 quality-scenario headers do not match the contract.");
}
for (const line of qualityLines.slice(2)) {
  const cells = splitRow(line);
  if (cells.length !== qualityHeaders.length || cells.some((cell) => !cell)) addIssue(`Incomplete quality scenario: ${line}`);
  if (!/^QS-\d{3}$/.test(cells[0] ?? "")) addIssue(`Invalid quality scenario ID: ${line}`);
}

const definitionFiles = [
  "01-introduction-and-goals.md", "05-building-block-view.md", "06-runtime-view.md",
  "07-deployment-view.md", "08-crosscutting-concepts.md", "10-quality-requirements.md",
  "11-risks-and-technical-debt.md", "TRACEABILITY.md"
];
const stableDefinitions = new Set();
for (const filename of definitionFiles) {
  for (const line of (await readFile(path.join(arc42Root, filename), "utf8")).split(/\r?\n/)) {
    const id = line.match(/^\|\s*((?:REQ|QS|BB|RT|DEP|CON|RISK|TEST|EVID)-\d{3})\s*\|/)?.[1];
    if (id) stableDefinitions.add(id);
  }
}
for (const directory of [".ballet/goals", ".ballet/adr"]) {
  for (const file of (await walk(path.join(root, directory))).filter((entry) => entry.endsWith(".md"))) {
    const id = (await parseMarkdown(file)).frontmatter?.id;
    if (typeof id === "string") stableDefinitions.add(id);
  }
}
const traceLines = markerBlock(docs.get(path.join(arc42Root, "TRACEABILITY.md"))?.source ?? "", "traceability")
  .split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
for (const line of traceLines.slice(2)) for (const id of line.match(
  /\b(?:goal|adr)-\d{3}\b|\b(?:REQ|QS|BB|RT|DEP|CON|RISK|TEST|EVID)-\d{3}\b/g
) ?? []) if (!stableDefinitions.has(id)) addIssue(`TRACEABILITY references undefined ID ${id}.`);

const adrIndex = path.join(arc42Root, "09-architecture-decisions.md");
for (const line of (docs.get(adrIndex)?.body ?? "").split(/\r?\n/)) {
  const match = line.match(/^\|\s*(adr-\d{3})\s*\|[^|]*\|\s*\[[^\]]+\]\(([^)]+)\)/);
  if (!match) continue;
  const target = path.resolve(path.dirname(adrIndex), match[2]);
  if (!(await exists(target))) addIssue(`Section 9 ADR link does not resolve: ${match[2]}.`);
  else if ((await parseMarkdown(target)).frontmatter?.id !== match[1]) addIssue(`Section 9 link does not contain ${match[1]}.`);
}

const rawConfig = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8"));
const parsed = projectConfigSchema.safeParse(rawConfig);
let config;
if (!parsed.success) {
  parsed.error.issues.forEach((issue) => addIssue(`.ballet/project.json:${issue.path.join(".")}: ${issue.message}`));
} else {
  config = parsed.data;
  const automation = { version: 18, graph: config.graph };
  validateProjectAutomationConfig(automation, config.executionProfiles)
    .forEach((issue) => addIssue(`Automation ${issue.path}: ${issue.message}`));
  const resources = await loadProjectResources(root);
  resources.issues.forEach((issue) => addIssue(`Resource ${issue.relativePath}: ${issue.message}`));
  validateProjectExecutionResources(automation, resources)
    .forEach((issue) => addIssue(`Resource reference ${issue.path}: ${issue.message}`));

  if (config.version !== expectedVersions.project) addIssue(`Project Config must be v${expectedVersions.project}.`);
  if (config.graph.strategy.kind !== "reward_mdp_v3") addIssue("Default Graph must use reward_mdp_v3.");
  if (config.graph.strategy.model.version !== expectedVersions.decisionModel) addIssue("Decision Model must be v3.");
  if (config.graph.strategy.capabilityModel.version !== expectedVersions.capabilityModel) addIssue("Capability Model must be v3.");
  const graphNodeIds = config.graph.graphNodes.map(({ id }) => id);
  if (JSON.stringify(graphNodeIds) !== JSON.stringify(expectedGraphNodeIds)) addIssue(`Default GraphNode order mismatch: ${graphNodeIds.join(", ")}`);
  const designJobs = config.graph.graphNodes.find(({ id }) => id === "design")?.actionNodes.map(({ id }) => id) ?? [];
  if (JSON.stringify(designJobs) !== JSON.stringify(expectedDesignJobs)) addIssue(`DESIGN Action order mismatch: ${designJobs.join(", ")}`);

  const model = config.graph.strategy.model;
  if (model.discountPpm !== 990_000) addIssue("Reward-MDP discount must be 990000 ppm.");
  const reward = model.reward;
  const expectedReward = [
    reward.actionCostMicros === 1_000_000, reward.completionBonusMicros === 25_000_000,
    reward.progressPotentialScaleMicros === 100_000_000,
    reward.outcomePenaltyMicros.transient === 2_000_000,
    reward.outcomePenaltyMicros.implementation_defect === 5_000_000,
    reward.outcomePenaltyMicros.invalid_plan === 12_000_000,
    reward.outcomePenaltyMicros.invalid_design === 25_000_000
  ];
  if (expectedReward.some((valid) => !valid)) addIssue("Reward-MDP default reward constants do not match adr-031.");
  for (const row of model.stateActions) {
    if (row.successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0) !== 1_000_000) {
      addIssue(`PPM does not sum to 1000000 for ${row.stateId}/${row.actionId}.`);
    }
    if (row.successors.some(({ provenance }) => provenance !== "default_prior" && provenance !== "authored_evidence")) {
      addIssue(`Invalid prior provenance for ${row.stateId}/${row.actionId}.`);
    }
  }
  const actionCounts = new Map();
  for (const row of model.stateActions) actionCounts.set(row.stateId, (actionCounts.get(row.stateId) ?? 0) + 1);
  if (![...actionCounts.values()].some((count) => count >= 2)) addIssue("Default Reward-MDP has no state with at least two actions.");
  if (!model.states.some(({ terminal }) => terminal === "success")) addIssue("Default Reward-MDP has no success terminal.");

  const profiles = new Map(config.executionProfiles.map((profile) => [profile.id, profile]));
  for (const graphNode of config.graph.graphNodes) for (const action of graphNode.actionNodes) {
    for (const [role, node] of [["work", action.workNode], ["validation", action.validationNode]]) {
      if (node.type !== "agent") continue;
      const profile = profiles.get(node.executionProfileId);
      if (profile?.model !== "gpt-5.6-sol" || profile.reasoningEffort !== "high") {
        addIssue(`${graphNode.id}/${action.id}/${role} must use gpt-5.6-sol high.`);
      }
    }
  }

  const stateSource = docs.get(path.join(arc42Root, "STATE-CONTRACT.md"))?.source ?? "";
  const stateJson = markerBlock(stateSource, "arc42-state-initial").match(/```json\s*([\s\S]*?)```/)?.[1];
  let contractState;
  try { contractState = JSON.parse(stateJson ?? ""); } catch { addIssue("STATE-CONTRACT initial JSON is invalid."); }
  const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
      : JSON.stringify(value);
  if (contractState && canonical(config.graph.state.initial) !== canonical(contractState)) {
    addIssue("Graph initial State differs from STATE-CONTRACT.");
  }
}

const instructionFiles = (await Promise.all([
  walk(path.join(root, ".ballet/instructions")),
  walk(path.join(root, ".fixture-ballet-project/.ballet/instructions"))
])).flat();
const migrated = instructionFiles.filter((file) => path.basename(file).startsWith("migrated-") && file.endsWith(".md"));
if (migrated.length) addIssue(`Legacy migrated instructions remain: ${migrated.map(rel).join(", ")}`);

const platformForbidden = [
  "blueprint-design", "milestone-planning", "milestone-delivery", "release-validation",
  "arc42-clarify-requirements", "arc42-design-structures", "arc42-design-concepts",
  "arc42-communicate-document", "arc42-accompany-implementation", "arc42-analyze-evaluate",
  "arc42-continuous-learning", ".ballet/arc42/", "ROADMAP.md", "IMPLEMENTATION-PLAN.md", "ACCEPTANCE.md"
];
const legacyRuntimeTerms = ["agent_v1", "ssp_v2", "RepairNode", "RepairRequest", "repair_requests", "routing_requests", "routing_decisions"];
for (const directory of ["backend", "frontend", "shared"]) for (const file of await walk(path.join(root, directory))) {
  if (!/\.(?:ts|tsx|js|jsx|json|md)$/.test(file) || /\.(?:test|spec)\.[^.]+$/.test(file)) continue;
  const source = await readFile(file, "utf8");
  for (const term of platformForbidden) if (source.includes(term)) addIssue(`Platform boundary violation: ${rel(file)} contains ${term}.`);
  for (const term of legacyRuntimeTerms) if (source.includes(term)) addIssue(`Legacy runtime path: ${rel(file)} contains ${term}.`);
}
for (const file of [path.join(root, ".ballet/project.json"), ...(await walk(path.join(root, ".ballet/graph-node-library")))]) {
  if (!(await stat(file)).isFile()) continue;
  const source = await readFile(file, "utf8");
  for (const term of legacyRuntimeTerms) if (source.includes(term)) addIssue(`Legacy project data: ${rel(file)} contains ${term}.`);
}

if (issues.length) {
  process.stderr.write(`arc42 validation failed with ${issues.length} issue(s):\n`);
  issues.forEach((issue) => process.stderr.write(`- ${issue}\n`));
  process.exitCode = 1;
} else {
  const graphNodes = config?.graph.graphNodes.length ?? 0;
  const actions = config?.graph.graphNodes.reduce((total, node) => total + node.actionNodes.length, 0) ?? 0;
  const mdpRows = config?.graph.strategy.model.stateActions.length ?? 0;
  process.stdout.write(`arc42 validation passed: ${sections.length} sections, ${ids.size} document IDs, ${graphNodes} GraphNodes, ${actions} ordered Action Nodes, ${mdpRows} Reward-MDP rows.\n`);
}
