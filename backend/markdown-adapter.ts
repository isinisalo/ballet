import path from "node:path";
import { mkdir, stat, unlink } from "node:fs/promises";
import type { Adr, AdrStatus, Agent, AgentStatus, AppData, EntityStatus, Goal, MarkdownDocument, Project, Skill } from "../shared/domain.js";
import { defaultProjectAutomationConfig } from "./automation.js";
import { assertInsideRoot, loadAdr, loadAgents, loadBalletProject, loadBalletProjectTree, loadGoals, loadSkills, readMarkdownDocument, safeSlug, writeMarkdownDocument, writeTomlDocument } from "./markdown.js";

const now = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
const booleanValue = (value: unknown, fallback = false): boolean => typeof value === "boolean" ? value : typeof value === "string" ? value.toLowerCase() === "true" : fallback;
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
const validEntityStatus = (value: unknown): EntityStatus => ["active", "paused", "archived"].includes(stringValue(value)) ? stringValue(value) as EntityStatus : "active";
const validGoalStatus = (value: unknown): Goal["status"] => ["not-started", "in-progress", "at-risk", "done"].includes(stringValue(value)) ? stringValue(value) as Goal["status"] : "not-started";
const validAdrStatus = (value: unknown): AdrStatus => ["proposed", "accepted", "superseded", "rejected"].includes(stringValue(value)) ? stringValue(value) as AdrStatus : "proposed";
const validAgentStatus = (value: unknown): AgentStatus => ["online", "offline"].includes(stringValue(value)) ? stringValue(value) as AgentStatus : "offline";
const dateValue = (value: unknown): string => stringValue(value, now());

const bodyPreview = (body: string): string => body.replace(/^#+\s+/gm, "").split(/\n{2,}/)[0]?.trim() ?? "";

const attachDocument = <T extends object>(entity: T, doc: MarkdownDocument): T => ({
  ...entity,
  frontmatter: doc.frontmatter,
  body: doc.body,
  relativePath: doc.relativePath,
  slug: doc.slug,
  errors: doc.errors
});

const projectFromDocument = (doc: MarkdownDocument): Project => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: doc.body.trim(),
    status: validEntityStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const goalFromDocument = (doc: MarkdownDocument, defaultProjectId: string): Goal => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    projectId: stringValue(fm.projectId, defaultProjectId),
    title: stringValue(fm.title, doc.title ?? doc.slug),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    status: validGoalStatus(fm.status),
    targetDate: stringValue(fm.targetDate ?? fm.dueDate),
    owner: stringValue(fm.owner),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const adrFromDocument = (doc: MarkdownDocument, defaultProjectId: string): Adr => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    projectId: stringValue(fm.projectId, defaultProjectId),
    title: stringValue(fm.title, doc.title ?? doc.slug),
    context: stringValue(fm.context, doc.body),
    decision: stringValue(fm.decision),
    consequences: stringValue(fm.consequences),
    status: validAdrStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};

const skillFromUnknown = (value: unknown, index: number): Skill => {
  if (isRecord(value)) {
    const name = stringValue(value.name ?? value.id, `skill-${index + 1}`);
    const metadata = Object.fromEntries(Object.entries(value).filter(([key]) => !["id", "name", "description", "enabled"].includes(key)).map(([key, item]) => [key, stringValue(item)]));
    return {
      id: stringValue(value.id, safeSlug(name)),
      name,
      description: stringValue(value.description),
      metadata,
      enabled: booleanValue(value.enabled, true)
    };
  }
  const name = stringValue(value, `skill-${index + 1}`);
  return { id: safeSlug(name), name, description: "", metadata: {}, enabled: true };
};

const normalizeSkillConfigPath = (value: string): string => {
  const trimmed = value.trim().replaceAll("\\", "/").replace(/\/SKILL\.md$/i, "");
  const segments = trimmed.split("/").filter(Boolean);
  const agentsSkillsIndex = segments.findIndex((segment, index) => segment === ".agents" && segments[index + 1] === "skills");
  if (agentsSkillsIndex >= 0) return segments.slice(agentsSkillsIndex).join("/");
  return path.posix.normalize(trimmed).replace(/^\.\//, "");
};

const skillLookupKeys = (skill: Skill): string[] => {
  const keys = [skill.id, skill.slug].filter(Boolean) as string[];
  if (skill.relativePath) {
    const normalized = normalizeSkillConfigPath(skill.relativePath);
    keys.push(normalized, normalized.replace(/\/SKILL\.md$/i, ""), path.posix.basename(normalized.replace(/\/SKILL\.md$/i, "")));
  }
  return [...new Set(keys)];
};

const buildSkillLookup = (skills: Skill[]): Map<string, Skill> => {
  const lookup = new Map<string, Skill>();
  for (const skill of skills) {
    for (const key of skillLookupKeys(skill)) {
      lookup.set(key, skill);
    }
  }
  return lookup;
};

const skillFromConfig = (value: unknown, index: number, skillLookup: Map<string, Skill>): Skill | undefined => {
  if (!isRecord(value)) return undefined;
  const rawPath = stringValue(value.path).trim();
  if (!rawPath) return undefined;

  const normalizedPath = normalizeSkillConfigPath(rawPath);
  const name = path.posix.basename(normalizedPath) || `skill-${index + 1}`;
  const enabled = booleanValue(value.enabled, true);
  const matchedSkill = skillLookup.get(normalizedPath) ?? skillLookup.get(name) ?? skillLookup.get(safeSlug(name));
  const metadata = { ...(matchedSkill?.metadata ?? {}), path: rawPath };

  return matchedSkill
    ? { ...matchedSkill, metadata, enabled }
    : {
      id: safeSlug(name),
      name,
      description: "",
      metadata,
      enabled
    };
};

const agentSkillsFromFrontmatter = (fm: Record<string, unknown>, skillLookup: Map<string, Skill>): Skill[] => {
  if (Array.isArray(fm.skills)) return fm.skills.map(skillFromUnknown);

  if (isRecord(fm.skills) && Array.isArray(fm.skills.config)) {
    return fm.skills.config
      .map((skill, index) => skillFromConfig(skill, index, skillLookup))
      .filter((skill): skill is Skill => Boolean(skill));
  }

  return [];
};

const agentFromDocument = (doc: MarkdownDocument, skillLookup: Map<string, Skill>): Agent => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    instructions: stringValue(fm.developer_instructions ?? fm.instructions, doc.body),
    skills: agentSkillsFromFrontmatter(fm, skillLookup),
    enabled: booleanValue(fm.enabled, true),
    status: validAgentStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt),
    model: stringValue(fm.model) || undefined,
    modelReasoningEffort: stringValue(fm.model_reasoning_effort) || undefined,
    nicknameCandidates: stringArray(fm.nickname_candidates)
  }, doc);
};

const skillDocumentFromDocument = (doc: MarkdownDocument): Skill => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, doc.title ?? doc.slug),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    metadata: Object.fromEntries(Object.entries(fm).filter(([key]) => !["id", "name", "description"].includes(key)).map(([key, value]) => [key, stringValue(value)]))
  }, doc);
};

export const loadMarkdownAppData = async (root: string): Promise<AppData> => {
  const [projectDocs, projectDocumentTree, agentDocs, skillDocs, adrDocs, goalDocs] = await Promise.all([
    loadBalletProject(root),
    loadBalletProjectTree(root),
    loadAgents(root),
    loadSkills(root),
    loadAdr(root),
    loadGoals(root)
  ]);

  const projects = projectDocs.map(projectFromDocument);
  const defaultProjectId = projects[0]?.id ?? "project";
  const skills = skillDocs.map(skillDocumentFromDocument);
  const skillLookup = buildSkillLookup(skills);
  const agents = agentDocs.map((doc) => agentFromDocument(doc, skillLookup));

  return {
    projectRoot: root,
    projects,
    goals: goalDocs.map((doc) => goalFromDocument(doc, defaultProjectId)),
    adrs: adrDocs.map((doc) => adrFromDocument(doc, defaultProjectId)),
    agents,
    skills,
    runtimes: [],
    policies: [],
    eventDefinitions: [],
    events: [],
    agentRuns: [],
    automation: defaultProjectAutomationConfig(),
    automationIssues: [],
    projectDocumentTree,
    documents: {
      project: projectDocs,
      agents: agentDocs,
      skills: skillDocs,
      runtimes: [],
      adr: adrDocs,
      goals: goalDocs,
      events: [],
      policies: []
    }
  };
};

const collectionFolder: Record<string, string> = {
  projects: ".ballet",
  goals: ".ballet/goals",
  adrs: ".ballet/adr",
  agents: ".codex/agents",
  skills: ".agents/skills"
};

const collectionName: Record<string, string> = {
  projects: "project",
  goals: "goals",
  adrs: "adr",
  agents: "agents",
  skills: "skills"
};

const entityBody = (item: Record<string, unknown>): string => stringValue(item.body);
const projectBody = (item: Record<string, unknown>): string => stringValue(item.description, stringValue(item.body));

const entityFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  const updatedAt = now();
  return {
    ...base,
    ...Object.fromEntries(Object.entries(item).filter(([key]) => !["frontmatter", "body", "relativePath", "slug", "errors", "createdAt", "updatedAt"].includes(key))),
    id,
    createdAt: item.createdAt ?? base.createdAt ?? updatedAt,
    updatedAt
  };
};

const projectFrontmatter = (item: Record<string, unknown>, id: string): Record<string, unknown> => {
  const frontmatter = entityFrontmatter(item, id);
  delete frontmatter.key;
  delete frontmatter.title;
  delete frontmatter.description;
  return frontmatter;
};

const agentFrontmatter = (item: Record<string, unknown>): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  const model = stringValue(item.model ?? base.model);
  const modelReasoningEffort = stringValue(item.model_reasoning_effort ?? item.modelReasoningEffort ?? base.model_reasoning_effort);
  const status = validAgentStatus(item.status ?? base.status);
  const nicknameCandidates = Array.isArray(item.nickname_candidates)
    ? stringArray(item.nickname_candidates)
    : Array.isArray(item.nicknameCandidates)
      ? stringArray(item.nicknameCandidates)
      : stringArray(base.nickname_candidates);

  const next: Record<string, unknown> = {
    ...base,
    name: stringValue(item.name ?? base.name),
    status,
    description: stringValue(item.description ?? base.description),
    developer_instructions: stringValue(item.developer_instructions ?? item.instructions ?? base.developer_instructions)
  };

  if (model) next.model = model;
  else delete next.model;
  if (modelReasoningEffort) next.model_reasoning_effort = modelReasoningEffort;
  else delete next.model_reasoning_effort;
  if (nicknameCandidates.length > 0) next.nickname_candidates = nicknameCandidates;
  else delete next.nickname_candidates;

  return next;
};

const skillFrontmatter = (item: Record<string, unknown>): Record<string, unknown> => {
  const base = isRecord(item.frontmatter) ? { ...item.frontmatter } : {};
  return {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description)
  };
};

export const writeEntityMarkdown = async (root: string, collection: keyof typeof collectionFolder, item: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const id = stringValue(item.id, safeSlug(stringValue(item.title ?? item.name, collectionName[collection])));
  const existingPath = stringValue(item.relativePath);
  const markdownFilename = `${safeSlug(id)}.md`;
  const relativePath = collection === "projects"
    ? ".ballet/project.md"
    : collection === "agents"
      ? existingPath || path.posix.join(collectionFolder[collection], `${safeSlug(stringValue(item.name, id))}.toml`)
      : collection === "skills"
        ? existingPath || path.posix.join(collectionFolder[collection], safeSlug(stringValue(item.name, id)), "SKILL.md")
        : existingPath || path.posix.join(collectionFolder[collection], markdownFilename);
  const frontmatter = collection === "projects"
    ? projectFrontmatter(item, id)
    : collection === "agents"
      ? agentFrontmatter(item)
      : collection === "skills"
        ? skillFrontmatter(item)
        : entityFrontmatter(item, id);
  const body = collection === "projects" ? projectBody(item) : entityBody(item);
  if (collection === "agents") {
    await writeTomlDocument({ root, relativePath, frontmatter });
  } else {
    await writeMarkdownDocument({ root, relativePath, frontmatter, body });
  }
  return { ...item, id, frontmatter, relativePath, slug: safeSlug(path.basename(relativePath, path.extname(relativePath))) };
};

export const removeEntityMarkdown = async (root: string, relativePath: string): Promise<void> => {
  const absolutePath = assertInsideRoot(root, relativePath);
  await unlink(absolutePath);
};

export const writeProjectMarkdownDocument = async (
  root: string,
  input: {
    relativePath: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }
): Promise<MarkdownDocument> => {
  const absolutePath = assertInsideRoot(root, input.relativePath);
  const balletRoot = assertInsideRoot(root, ".ballet");
  const relativeToBallet = path.relative(balletRoot, absolutePath);

  if (relativeToBallet.startsWith("..") || path.isAbsolute(relativeToBallet)) {
    throw new Error("Project document must be inside .ballet.");
  }

  if (path.extname(absolutePath).toLowerCase() !== ".md") {
    throw new Error("Project document must be a .md file.");
  }

  const existing = await stat(absolutePath);
  if (!existing.isFile()) {
    throw new Error("Project document must be an existing file.");
  }

  await writeMarkdownDocument({
    root,
    relativePath: input.relativePath,
    frontmatter: input.frontmatter,
    body: input.body
  });

  return readProjectMarkdownDocument(root, input.relativePath);
};

export const createProjectMarkdownDocument = async (
  root: string,
  input: {
    directoryPath: string;
    title: string;
  }
): Promise<MarkdownDocument> => {
  const title = input.title.trim();
  if (!title) throw new Error("title is required.");

  const absoluteDirectoryPath = assertInsideRoot(root, input.directoryPath);
  const balletRoot = assertInsideRoot(root, ".ballet");
  const relativeToBallet = path.relative(balletRoot, absoluteDirectoryPath);

  if (relativeToBallet.startsWith("..") || path.isAbsolute(relativeToBallet)) {
    throw new Error("Project document must be inside .ballet.");
  }

  const normalizedDirectoryPath = path.relative(path.resolve(root), absoluteDirectoryPath).split(path.sep).join("/");
  if (path.extname(normalizedDirectoryPath)) {
    throw new Error("Project document directory must not include a file extension.");
  }

  await mkdir(absoluteDirectoryPath, { recursive: true });

  const slug = safeSlug(title);
  let filename = `${slug}.md`;
  let suffix = 2;

  while (true) {
    const absoluteCandidatePath = path.join(absoluteDirectoryPath, filename);
    try {
      await stat(absoluteCandidatePath);
      filename = `${slug}-${suffix}.md`;
      suffix += 1;
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }

  const relativePath = path.relative(path.resolve(root), path.join(absoluteDirectoryPath, filename)).split(path.sep).join("/");
  const timestamp = now();
  await writeMarkdownDocument({
    root,
    relativePath,
    frontmatter: {
      title,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    body: ""
  });

  return readProjectMarkdownDocument(root, relativePath);
};

const readProjectMarkdownDocument = async (root: string, relativePath: string): Promise<MarkdownDocument> => {
  return readMarkdownDocument({ root, relativePath, collection: "project" });
};
