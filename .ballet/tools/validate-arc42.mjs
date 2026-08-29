import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import { projectConfigurationV20Schema } from "../../shared/orchestration/schemas/environmentSchemas.ts";
import { validateActionInstruction } from "../../shared/orchestration/instructionContract.ts";

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
  ...["BRIEF.md", "PLAN.md", "EVIDENCE.md", "REVIEW.md"].flatMap((name) => [
    `.ballet/arc42/initiatives/TEMPLATE/${name}`,
    `.ballet/arc42/initiatives/environment-state-action-orchestration/${name}`
  ]),
  ...sections.map((name) => `.ballet/arc42/${name}`)
];

const addIssue = (message) => issues.push(message);
const rel = (absolute) => path.relative(root, absolute).split(path.sep).join("/");
const exists = async (absolute) => stat(absolute).then(() => true, () => false);
const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
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

const markdownFiles = [path.join(root, "ARCHITECTURE.md"), ...(await walk(arc42Root)).filter((file) => file.endsWith(".md"))];
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

const rawConfig = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8"));
const parsed = projectConfigurationV20Schema.safeParse(rawConfig);
let config;
if (!parsed.success) {
  parsed.error.issues.forEach((issue) => addIssue(`.ballet/project.json:${issue.path.join(".")}: ${issue.message}`));
} else {
  config = parsed.data;
  const directionRoots = { goals: "goals", adrs: "adr", constraints: "constraints", useCases: "use-cases" };
  for (const [field, directory] of Object.entries(directionRoots)) {
    const documents = await indexedMarkdown(path.join(root, ".ballet", directory));
    for (const item of config.direction[field]) if (!documents.has(item.id)) {
      addIssue(`Project Config ${field} reference ${item.id} has no Markdown source.`);
    }
  }
  const instructionIds = new Set();
  const skillIds = new Set();
  for (const agent of allAgents(config)) {
    instructionIds.add(agent.instructionResource);
    agent.skillResources.forEach((id) => skillIds.add(id));
  }
  for (const id of instructionIds) {
    const filename = path.join(root, ".ballet/instructions", `${id}.md`);
    if (!(await exists(filename))) { addIssue(`Missing instruction resource ${id}.`); continue; }
    for (const issue of validateActionInstruction(await readFile(filename, "utf8"))) {
      addIssue(`Instruction ${id}: ${issue.message}.`);
    }
  }
  for (const id of skillIds) {
    const filename = path.join(root, ".agents/skills", id, "SKILL.md");
    if (!(await exists(filename))) addIssue(`Missing Skill resource ${id}.`);
  }
}

for (const removed of [".ballet/graph-node-library", ".ballet/graph-node-modules"]) {
  if (await exists(path.join(root, removed))) addIssue(`Removed project-data surface remains: ${removed}.`);
}

if (issues.length) {
  process.stderr.write(`arc42 validation failed with ${issues.length} issue(s):\n`);
  issues.forEach((issue) => process.stderr.write(`- ${issue}\n`));
  process.exitCode = 1;
} else {
  const states = config?.environment.states.length ?? 0;
  const actions = config?.environment.states.reduce((total, state) => total + state.actions.length, 0) ?? 0;
  process.stdout.write(`arc42 validation passed: ${sections.length} sections, ${ids.size} document IDs, Project Config v20, ${states} States and ${actions} Actions.\n`);
}

async function indexedMarkdown(directory) {
  const result = new Set();
  for (const filename of (await walk(directory)).filter((file) => file.endsWith(".md"))) {
    const parsedDocument = await parseMarkdown(filename);
    if (typeof parsedDocument.frontmatter?.id === "string") result.add(parsedDocument.frontmatter.id);
  }
  return result;
}

function allAgents(project) {
  return [
    project.critic.agent,
    project.refinement.agent,
    ...project.environment.states.flatMap((state) => state.actions.flatMap((action) => [action.validation, action.work]))
  ];
}
