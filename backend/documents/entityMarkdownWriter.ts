import path from "node:path";
import { unlink } from "node:fs/promises";
import { assertInsideRoot, safeSlug, writeMarkdownDocument, writeTomlDocument } from "../markdown.js";

const now = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];

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
  delete base.runtime;
  delete base.status;
  delete base.model;
  delete base.model_reasoning_effort;
  const nicknameCandidates = Array.isArray(item.nickname_candidates)
    ? stringArray(item.nickname_candidates)
    : Array.isArray(item.nicknameCandidates)
      ? stringArray(item.nicknameCandidates)
      : stringArray(base.nickname_candidates);

  const next: Record<string, unknown> = {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description),
    enabled: typeof item.enabled === "boolean" ? item.enabled : base.enabled !== false,
    developer_instructions: stringValue(item.developer_instructions ?? item.instructions ?? base.developer_instructions)
  };

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
