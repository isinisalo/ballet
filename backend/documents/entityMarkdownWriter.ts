import path from "node:path";
import { unlink } from "node:fs/promises";
import { normalizeAgentAvatar } from "../../shared/domain/agents.js";
import { assertInsideRoot, safeSlug, writeMarkdownDocument, writeTomlDocument } from "../markdown.js";

export type EntityMarkdownCollection = "agents" | "skills";

export const writeEntityMarkdown = async (
  root: string,
  collection: EntityMarkdownCollection,
  item: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const id = stringValue(item.id, safeSlug(stringValue(item.name, collection)));
  const existingPath = stringValue(item.relativePath);
  const relativePath = collection === "agents"
    ? existingPath || path.posix.join(".codex/agents", `${safeSlug(stringValue(item.name, id))}.toml`)
    : existingPath || path.posix.join(".agents/skills", safeSlug(stringValue(item.name, id)), "SKILL.md");
  const frontmatter = collection === "agents" ? agentFrontmatter(item) : skillFrontmatter(item);
  if (collection === "agents") await writeTomlDocument({ root, relativePath, frontmatter });
  else await writeMarkdownDocument({ root, relativePath, frontmatter, body: stringValue(item.body) });
  return {
    ...item,
    id,
    frontmatter,
    relativePath,
    slug: safeSlug(path.basename(relativePath, path.extname(relativePath)))
  };
};

export const removeEntityMarkdown = async (root: string, relativePath: string): Promise<void> => {
  await unlink(assertInsideRoot(root, relativePath));
};

const agentFrontmatter = (item: Record<string, unknown>): Record<string, unknown> => {
  const base = record(item.frontmatter);
  for (const key of ["runtime", "status", "model", "model_reasoning_effort", "node_style"]) delete base[key];
  const candidates = stringArray(item.nickname_candidates ?? item.nicknameCandidates ?? base.nickname_candidates);
  const avatar = item.avatar === null ? undefined : normalizeAgentAvatar(item.avatar ?? base.avatar);
  const next: Record<string, unknown> = {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description),
    enabled: typeof item.enabled === "boolean" ? item.enabled : base.enabled !== false,
    developer_instructions: stringValue(item.developer_instructions ?? item.instructions ?? base.developer_instructions)
  };
  if (avatar) next.avatar = avatar;
  else delete next.avatar;
  if (candidates.length > 0) next.nickname_candidates = candidates;
  else delete next.nickname_candidates;
  return next;
};

const skillFrontmatter = (item: Record<string, unknown>): Record<string, unknown> => {
  const base = record(item.frontmatter);
  return {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description)
  };
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...value as Record<string, unknown> } : {};
const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
const stringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map((item) => stringValue(item)).filter(Boolean)
  : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
