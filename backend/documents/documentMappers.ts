import { normalizeAgentNodeStyle, type Agent } from "../../shared/domain/agents.js";
import type { Adr, AdrStatus, EntityStatus, Goal, MarkdownDocument, Project, Skill } from "../../shared/domain/documents.js";
import { agentSkillsFromFrontmatter } from "./skillLookup.js";

const now = () => new Date().toISOString();

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);

const booleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : typeof value === "string" ? value.toLowerCase() === "true" : fallback;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

const validEntityStatus = (value: unknown): EntityStatus =>
  ["active", "paused", "archived"].includes(stringValue(value)) ? stringValue(value) as EntityStatus : "active";

const validGoalStatus = (value: unknown): Goal["status"] =>
  ["not-started", "in-progress", "at-risk", "done"].includes(stringValue(value)) ? stringValue(value) as Goal["status"] : "not-started";

const validAdrStatus = (value: unknown): AdrStatus =>
  ["proposed", "accepted", "superseded", "rejected"].includes(stringValue(value)) ? stringValue(value) as AdrStatus : "proposed";

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

export const projectFromDocument = (doc: MarkdownDocument): Project => {
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

export const goalFromDocument = (doc: MarkdownDocument, defaultProjectId: string): Goal => {
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

export const adrFromDocument = (doc: MarkdownDocument, defaultProjectId: string): Adr => {
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

export const agentFromDocument = (doc: MarkdownDocument, skillLookup: Map<string, Skill>): Agent => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    instructions: stringValue(fm.developer_instructions ?? fm.instructions, doc.body),
    skills: agentSkillsFromFrontmatter(fm, skillLookup),
    enabled: booleanValue(fm.enabled, true),
    nodeStyle: normalizeAgentNodeStyle(fm.node_style),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt),
    nicknameCandidates: stringArray(fm.nickname_candidates)
  }, doc);
};

export const skillDocumentFromDocument = (doc: MarkdownDocument): Skill => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, doc.title ?? doc.slug),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    metadata: Object.fromEntries(Object.entries(fm).filter(([key]) => !["id", "name", "description"].includes(key)).map(([key, value]) => [key, stringValue(value)]))
  }, doc);
};
