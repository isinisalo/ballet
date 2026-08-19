/* eslint-disable max-lines -- one deterministic project-contract validator is easier to audit as a single executable. */
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
const allowedStatuses = new Set(["draft", "review", "accepted", "superseded"]);
const issues = [];

const requiredSupport = [
  "ARCHITECTURE.md",
  ".ballet/arc42/README.md",
  ".ballet/arc42/STATUS.md",
  ".ballet/arc42/TRACEABILITY.md",
  ".ballet/arc42/METHOD-HEALTH.md",
  ".ballet/arc42/STATE-CONTRACT.md",
  ".ballet/arc42/migration/ASSESSMENT.md",
  ".ballet/arc42/migration/CONTENT-MAP.md",
  ".ballet/arc42/migration/DECISIONS.md",
  ".ballet/arc42/initiatives/TEMPLATE/BRIEF.md",
  ".ballet/arc42/initiatives/TEMPLATE/PLAN.md",
  ".ballet/arc42/initiatives/TEMPLATE/EVIDENCE.md",
  ".ballet/arc42/initiatives/TEMPLATE/REVIEW.md"
];

const sections = [
  "01-introduction-and-goals.md",
  "02-constraints.md",
  "03-context-and-scope.md",
  "04-solution-strategy.md",
  "05-building-block-view.md",
  "06-runtime-view.md",
  "07-deployment-view.md",
  "08-crosscutting-concepts.md",
  "09-architecture-decisions.md",
  "10-quality-requirements.md",
  "11-risks-and-technical-debt.md",
  "12-glossary.md"
];

const expectedFlow = [
  "arc42-clarify-requirements→arc42-design-structures",
  "arc42-design-structures→arc42-design-concepts",
  "arc42-design-concepts→arc42-communicate-document",
  "arc42-communicate-document→arc42-accompany-implementation",
  "arc42-accompany-implementation→arc42-analyze-evaluate"
];

const requiredRepairs = {
  "arc42-design-structures": ["arc42-clarify-requirements", "arc42-design-structures"],
  "arc42-design-concepts": ["arc42-clarify-requirements", "arc42-design-structures", "arc42-design-concepts"],
  "arc42-communicate-document": ["arc42-clarify-requirements", "arc42-design-structures", "arc42-design-concepts", "arc42-communicate-document"],
  "arc42-accompany-implementation": ["arc42-clarify-requirements", "arc42-design-structures", "arc42-design-concepts", "arc42-communicate-document", "arc42-accompany-implementation"],
  "arc42-analyze-evaluate": ["arc42-clarify-requirements", "arc42-design-structures", "arc42-design-concepts", "arc42-communicate-document", "arc42-accompany-implementation", "arc42-analyze-evaluate"],
  "arc42-continuous-learning": ["arc42-clarify-requirements", "arc42-design-structures", "arc42-design-concepts", "arc42-communicate-document", "arc42-analyze-evaluate", "arc42-continuous-learning"],
  "release-validation": ["arc42-communicate-document", "arc42-accompany-implementation", "arc42-analyze-evaluate", "release-validation"]
};

const networkAllowed = new Set([
  "arc42-continuous-learning/learning-authoritative-research/work",
  "release-validation/release-execute-authorized/work",
  "release-validation/release-execute-authorized/validation",
  "release-validation/release-verify-authorized/work"
]);

const addIssue = (message) => issues.push(message);
const rel = (absolute) => path.relative(root, absolute).split(path.sep).join("/");
const exists = async (absolute) => stat(absolute).then(() => true, () => false);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return nested.flat();
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

const splitTableRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const markerBlock = (source, name) => {
  const match = source.match(new RegExp(`<!-- ${name}:start -->([\\s\\S]*?)<!-- ${name}:end -->`));
  return match?.[1] ?? "";
};

const headingAnchors = (body) => {
  const counts = new Map();
  const anchors = new Set();
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1];
    if (!heading) continue;
    const base = heading.toLowerCase()
      .replace(/`([^`]*)`/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
};

for (const required of [...requiredSupport, ...sections.map((name) => `.ballet/arc42/${name}`)]) {
  if (!(await exists(path.join(root, required)))) addIssue(`Missing required arc42 artifact: ${required}`);
}

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
  if (!fm || typeof fm !== "object") {
    addIssue(`${rel(file)}: frontmatter is required.`);
    continue;
  }
  for (const field of ["id", "title", "status", "createdAt", "updatedAt", "version", "tags"]) {
    if (fm[field] === undefined || fm[field] === null || fm[field] === "") addIssue(`${rel(file)}: missing frontmatter field ${field}.`);
  }
  if (!allowedStatuses.has(fm.status)) addIssue(`${rel(file)}: invalid status ${String(fm.status)}.`);
  if (!Array.isArray(fm.tags)) addIssue(`${rel(file)}: tags must be an array.`);
  if (typeof fm.id === "string") {
    const previous = ids.get(fm.id);
    if (previous) addIssue(`Duplicate frontmatter id ${fm.id}: ${previous} and ${rel(file)}.`);
    else ids.set(fm.id, rel(file));
  }
}

for (let index = 0; index < sections.length; index += 1) {
  const file = path.join(arc42Root, sections[index]);
  const fm = docs.get(file)?.frontmatter;
  if (fm?.arc42Section !== index + 1) addIssue(`${rel(file)}: arc42Section must be ${index + 1}.`);
  const prefix = String(index + 1).padStart(2, "0");
  if (!path.basename(file).startsWith(`${prefix}-`)) addIssue(`${rel(file)}: filename does not match section ${prefix}.`);
}

for (const [file, doc] of docs) {
  const links = [...doc.body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
  for (const rawTarget of links) {
    const target = rawTarget.replace(/^<|>$/g, "").split(/\s+["']/)[0];
    if (/^(?:https?:|mailto:|app:)/.test(target)) continue;
    const [pathPart, rawAnchor] = target.split("#", 2);
    const linkedFile = pathPart ? path.resolve(path.dirname(file), decodeURIComponent(pathPart)) : file;
    if (!(await exists(linkedFile))) {
      addIssue(`${rel(file)}: broken local link ${rawTarget}.`);
      continue;
    }
    if (rawAnchor && linkedFile.endsWith(".md")) {
      const linkedDoc = docs.get(linkedFile) ?? await parseMarkdown(linkedFile);
      if (!headingAnchors(linkedDoc.body).has(decodeURIComponent(rawAnchor).toLowerCase())) {
        addIssue(`${rel(file)}: unresolved anchor ${rawTarget}.`);
      }
    }
  }
}

const qualityFile = path.join(arc42Root, "10-quality-requirements.md");
const qualitySource = docs.get(qualityFile)?.source ?? "";
const qualityLines = markerBlock(qualitySource, "quality-scenarios").split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
const requiredQualityHeaders = ["ID", "Source", "Stimulus", "Environment", "Affected artifact", "Expected response", "Measurable response criterion", "Priority", "Evidence", "Status"];
if (qualityLines.length < 3) addIssue("Section 10 has no quality-scenario rows.");
else {
  const headers = splitTableRow(qualityLines[0]);
  if (JSON.stringify(headers) !== JSON.stringify(requiredQualityHeaders)) addIssue("Section 10 quality-scenario headers do not match the required contract.");
  for (const line of qualityLines.slice(2)) {
    const cells = splitTableRow(line);
    if (cells.length !== requiredQualityHeaders.length || cells.some((cell) => !cell)) addIssue(`Incomplete quality scenario row: ${line}`);
    if (!/^QS-\d{3}$/.test(cells[0] ?? "")) addIssue(`Invalid quality scenario ID in row: ${line}`);
  }
}

const stableDefinitions = new Set();
for (const file of [
  ".ballet/arc42/01-introduction-and-goals.md",
  ".ballet/arc42/05-building-block-view.md",
  ".ballet/arc42/06-runtime-view.md",
  ".ballet/arc42/07-deployment-view.md",
  ".ballet/arc42/08-crosscutting-concepts.md",
  ".ballet/arc42/10-quality-requirements.md",
  ".ballet/arc42/11-risks-and-technical-debt.md",
  ".ballet/arc42/TRACEABILITY.md"
]) {
  const source = await readFile(path.join(root, file), "utf8");
  for (const line of source.split(/\r?\n/)) {
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

const traceFile = path.join(arc42Root, "TRACEABILITY.md");
const traceSource = docs.get(traceFile)?.source ?? "";
const traceLines = markerBlock(traceSource, "traceability").split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
if (traceLines.length < 3) addIssue("TRACEABILITY has no trace rows.");
for (const line of traceLines.slice(2)) {
  for (const id of line.match(/\b(?:goal|adr)-\d{3}\b|\b(?:REQ|QS|BB|RT|DEP|CON|RISK|TEST|EVID)-\d{3}\b/g) ?? []) {
    if (!stableDefinitions.has(id)) addIssue(`TRACEABILITY references undefined ID ${id}.`);
  }
}

const adrIndex = path.join(arc42Root, "09-architecture-decisions.md");
for (const line of (docs.get(adrIndex)?.body ?? "").split(/\r?\n/)) {
  const match = line.match(/^\|\s*(adr-\d{3})\s*\|[^|]*\|\s*\[[^\]]+\]\(([^)]+)\)/);
  if (!match) continue;
  const target = path.resolve(path.dirname(adrIndex), match[2]);
  if (!(await exists(target))) addIssue(`Section 9 ADR link does not resolve: ${match[2]}.`);
  else if ((await parseMarkdown(target)).frontmatter?.id !== match[1]) addIssue(`Section 9 ADR link ${match[2]} does not contain ${match[1]}.`);
}

const configPath = path.join(root, ".ballet/project.json");
const rawConfig = JSON.parse(await readFile(configPath, "utf8"));
const parsedConfig = projectConfigSchema.safeParse(rawConfig);
let config;
if (!parsedConfig.success) {
  for (const issue of parsedConfig.error.issues) addIssue(`.ballet/project.json:${issue.path.join(".")}: ${issue.message}`);
} else {
  config = parsedConfig.data;
  const automation = {
    version: 11,
    orchestrator: config.orchestrator,
    graph: config.graph,
    loops: config.loops
  };
  for (const issue of validateProjectAutomationConfig(automation, config.executionProfiles)) addIssue(`Automation ${issue.path}: ${issue.message}`);
  const resources = await loadProjectResources(root);
  for (const issue of resources.issues) addIssue(`Resource ${issue.relativePath}: ${issue.message}`);
  for (const issue of validateProjectExecutionResources(automation, resources)) addIssue(`Resource reference ${issue.path}: ${issue.message}`);

  for (const loop of config.loops) for (const node of loop.nodes) {
    const outgoing = loop.edges.filter((edge) => edge.source === node.id);
    if (outgoing.length !== 1) addIssue(`${loop.id}/${node.id} has ${outgoing.length} Validation OK edges; expected 1.`);
  }

  const flow = config.graph.loopEdges.filter((edge) => edge.kind === "flow").map((edge) => `${edge.source}→${edge.target}`);
  if (JSON.stringify(flow) !== JSON.stringify(expectedFlow)) addIssue(`Default flow mismatch: ${flow.join(", ")}`);

  const repairPairs = new Set(config.graph.loopEdges.filter((edge) => edge.kind === "repair").map((edge) => `${edge.source}→${edge.target}`));
  for (const [source, targets] of Object.entries(requiredRepairs)) for (const target of targets) {
    if (!repairPairs.has(`${source}→${target}`)) addIssue(`Missing repair capability ${source}→${target}.`);
  }

  const stateSource = docs.get(path.join(arc42Root, "STATE-CONTRACT.md"))?.source ?? "";
  const stateJson = markerBlock(stateSource, "arc42-state-initial").match(/```json\s*([\s\S]*?)```/)?.[1];
  let contractState;
  try { contractState = JSON.parse(stateJson ?? ""); } catch { addIssue("STATE-CONTRACT initial JSON is invalid."); }
  const canonical = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());
  const deepCanonical = (value) => Array.isArray(value)
    ? `[${value.map(deepCanonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${deepCanonical(value[key])}`).join(",")}}`
      : JSON.stringify(value);
  const arc42Loops = config.loops.filter((entry) => entry.id.startsWith("arc42-"));
  const baseline = arc42Loops[0]?.state.initial;
  for (const entry of arc42Loops) {
    if (deepCanonical(entry.state.initial) !== deepCanonical(baseline)) addIssue(`${entry.id} initial State differs from other arc42 Loops.`);
    if (contractState && deepCanonical(entry.state.initial) !== deepCanonical(contractState)) addIssue(`${entry.id} initial State differs from STATE-CONTRACT.`);
  }
  void canonical;

  const profiles = new Map(config.executionProfiles.map((entry) => [entry.id, entry]));
  for (const entry of config.executionProfiles) {
    if (entry.reasoningEffort !== "medium") addIssue(`ExecutionProfile ${entry.id} does not preserve medium baseline.`);
    if (/(?:high|xhigh|max|pro)/i.test(entry.reasoningEffort) || "reasoning" in entry && entry.reasoning?.mode) addIssue(`Unsupported high/pro reasoning configuration in ${entry.id}.`);
  }
  const observedNetworkOn = new Set();
  for (const entry of config.loops) for (const item of entry.nodes) for (const [role, part] of [["work", item.work], ["validation", item.validation]]) {
    if (part.type === "human") continue;
    if (profiles.get(part.executionProfileId)?.networkAccess) observedNetworkOn.add(`${entry.id}/${item.id}/${role}`);
  }
  for (const location of observedNetworkOn) if (!networkAllowed.has(location)) addIssue(`Network-on profile used outside allowlist: ${location}.`);
  for (const location of networkAllowed) if (!observedNetworkOn.has(location)) addIssue(`Expected network-on node is not configured: ${location}.`);
  if (profiles.get(config.orchestrator.executionProfileId)?.networkAccess) addIssue("Orchestrator must use network-off profile.");

  const learning = config.loops.find((entry) => entry.id === "arc42-continuous-learning");
  const learningWork = learning?.nodes.find((entry) => entry.id === learning.startNodeId)?.work;
  const schedule = learningWork?.type === "scheduled" ? learningWork.schedule : undefined;
  if (!schedule || schedule.kind !== "recurring" || schedule.cadence !== "weekly" || schedule.startsOn !== "2026-08-17" || schedule.time !== "09:00" || schedule.timeZone !== "Europe/Helsinki" || JSON.stringify(schedule.weekdays) !== JSON.stringify(["mon"])) {
    addIssue("Continuous-learning schedule must be weekly Monday 09:00 Europe/Helsinki from 2026-08-17.");
  }
}

const instructionFiles = (await Promise.all([
  walk(path.join(root, ".ballet/instructions")),
  walk(path.join(root, ".fixture-ballet-project/.ballet/instructions"))
])).flat();
const legacyInstructions = instructionFiles.filter((file) => path.basename(file).startsWith("migrated-") && file.endsWith(".md"));
if (legacyInstructions.length > 0) addIssue(`Legacy migrated instructions remain: ${legacyInstructions.map(rel).join(", ")}`);

const forbidden = [
  "arc42-clarify-requirements",
  "arc42-design-structures",
  "arc42-design-concepts",
  "arc42-communicate-document",
  "arc42-accompany-implementation",
  "arc42-analyze-evaluate",
  "arc42-continuous-learning",
  ".ballet/arc42/"
];
for (const directory of ["backend", "frontend", "shared"]) {
  for (const file of await walk(path.join(root, directory))) {
    if (!/\.(?:ts|tsx|js|jsx|json|md)$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const term of forbidden) if (source.includes(term)) addIssue(`Platform boundary violation: ${rel(file)} contains ${term}.`);
  }
}

if (issues.length > 0) {
  process.stderr.write(`arc42 validation failed with ${issues.length} issue(s):\n`);
  for (const issue of issues) process.stderr.write(`- ${issue}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`arc42 validation passed: ${sections.length} sections, ${ids.size} unique document IDs, ${config?.loops.length ?? 0} Loops, ${config?.graph.loopEdges.length ?? 0} Loop Edges.\n`);
}
