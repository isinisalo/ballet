import { normalizeAgentAvatar, type Agent } from "../../shared/domain/agents.js";
import type { EntityStatus, MarkdownDocument, Project, Skill } from "../../shared/domain/documents.js";
import { agentSkillsFromFrontmatter } from "./skillLookup.js";
import { booleanValue, stringArray, stringValue } from "./documentValues.js";

const missingDate = new Date(0).toISOString();

const validEntityStatus = (value: unknown): EntityStatus =>
  ["active", "paused", "archived"].includes(stringValue(value)) ? stringValue(value) as EntityStatus : "active";

const dateValue = (value: unknown): string => stringValue(value, missingDate);

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

export const agentFromDocument = (doc: MarkdownDocument, skillLookup: Map<string, Skill>): Agent => {
  const fm = doc.frontmatter;
  const avatar = normalizeAgentAvatar(fm.avatar);
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: stringValue(fm.description, bodyPreview(doc.body)),
    instructions: stringValue(fm.developer_instructions ?? fm.instructions, doc.body),
    skills: agentSkillsFromFrontmatter(fm, skillLookup),
    enabled: booleanValue(fm.enabled, true),
    ...(avatar ? { avatar } : {}),
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
