import path from "node:path";
import { unlink } from "node:fs/promises";
import { normalizeAgentAvatar } from "../../shared/domain/agents.js";
import { safeSlug, writeMarkdownDocument, writeTomlDocument } from "../markdown.js";
import { MarkdownEntityConflictError, MarkdownEntityValidationError } from "./MarkdownEntityErrors.js";
import { assertInsideRoot, resolveSafeProjectPath } from "./safeProjectPath.js";
import { recordValue, stringArray, stringValue } from "./documentValues.js";

export type EntityMarkdownCollection = "agents" | "skills";

const collectionRoots: Record<EntityMarkdownCollection, string> = {
  agents: ".codex/agents",
  skills: ".agents/skills"
};

interface EntityWriteOptions {
  existing?: Record<string, unknown>;
}

export const writeEntityMarkdown = async (
  root: string,
  collection: EntityMarkdownCollection,
  item: Record<string, unknown>,
  options: EntityWriteOptions = {}
): Promise<Record<string, unknown>> => {
  const existing = options.existing ?? (typeof item.relativePath === "string" ? item : undefined);
  const id = stringValue(existing?.id, safeSlug(stringValue(item.name, collection)));
  const existingPath = stringValue(existing?.relativePath ?? item.relativePath);
  if (existingPath) await resolveEntityPath(root, collection, existingPath);
  const relativePath = collection === "agents"
    ? path.posix.join(collectionRoots.agents, `${id}.toml`)
    : existingPath || path.posix.join(".agents/skills", safeSlug(stringValue(item.name, id)), "SKILL.md");
  if (collection === "agents" && existingPath && path.resolve(root, existingPath) !== path.resolve(root, relativePath)) {
    throw new MarkdownEntityValidationError(`Agent document path must match its id: ${relativePath}.`);
  }
  await resolveEntityPath(root, collection, relativePath);
  const frontmatter = collection === "agents" ? agentFrontmatter(item, existing) : skillFrontmatter(item, existing);
  const exclusive = !existing;
  try {
    if (collection === "agents") await writeTomlDocument({ root, relativePath, frontmatter, exclusive });
    else await writeMarkdownDocument({ root, relativePath, frontmatter, body: stringValue(item.body), exclusive });
  } catch (error) {
    if (isAlreadyExisting(error)) throw new MarkdownEntityConflictError(`${collection === "agents" ? "Agent" : "Skill"} '${id}' already exists.`);
    throw error;
  }
  return {
    ...existing,
    ...item,
    id,
    frontmatter,
    relativePath,
    slug: safeSlug(path.basename(relativePath, path.extname(relativePath)))
  };
};

export const removeEntityMarkdown = async (
  root: string,
  collection: EntityMarkdownCollection,
  relativePath: string
): Promise<void> => {
  await unlink(await resolveEntityPath(root, collection, relativePath));
};

const agentFrontmatter = (
  item: Record<string, unknown>,
  existing?: Record<string, unknown>
): Record<string, unknown> => {
  const timestamp = new Date().toISOString();
  const existingFrontmatter = recordValue(existing?.frontmatter);
  const base = { ...existingFrontmatter, ...recordValue(item.frontmatter) };
  for (const key of ["runtime", "status", "model", "model_reasoning_effort", "node_style"]) delete base[key];
  const candidates = stringArray(item.nickname_candidates ?? item.nicknameCandidates ?? base.nickname_candidates);
  const avatar = item.avatar === null ? undefined : normalizeAgentAvatar(item.avatar ?? base.avatar);
  const next: Record<string, unknown> = {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description),
    enabled: typeof item.enabled === "boolean" ? item.enabled : base.enabled !== false,
    developer_instructions: stringValue(item.developer_instructions ?? item.instructions ?? base.developer_instructions),
    createdAt: stringValue(existingFrontmatter.createdAt, timestamp),
    updatedAt: timestamp
  };
  if (avatar) next.avatar = avatar;
  else delete next.avatar;
  if (candidates.length > 0) next.nickname_candidates = candidates;
  else delete next.nickname_candidates;
  return next;
};

const skillFrontmatter = (
  item: Record<string, unknown>,
  existing?: Record<string, unknown>
): Record<string, unknown> => {
  const base = { ...recordValue(existing?.frontmatter), ...recordValue(item.frontmatter) };
  delete base.id;
  return {
    ...base,
    name: stringValue(item.name ?? base.name),
    description: stringValue(item.description ?? base.description)
  };
};

const resolveEntityPath = async (
  root: string,
  collection: EntityMarkdownCollection,
  relativePath: string
): Promise<string> => {
  const absolutePath = assertInsideRoot(root, relativePath);
  const collectionRoot = assertInsideRoot(root, collectionRoots[collection]);
  const relativeToCollection = path.relative(collectionRoot, absolutePath);
  if (!relativeToCollection || relativeToCollection.startsWith("..") || path.isAbsolute(relativeToCollection)) {
    throw new MarkdownEntityValidationError(`Entity document must be inside ${collectionRoots[collection]}.`);
  }
  if (collection === "agents" && (path.dirname(absolutePath) !== collectionRoot || path.extname(absolutePath) !== ".toml")) {
    throw new MarkdownEntityValidationError("Agent document must be a direct .toml child of .codex/agents.");
  }
  if (collection === "skills" && path.basename(absolutePath) !== "SKILL.md") {
    throw new MarkdownEntityValidationError("Skill document must be named SKILL.md.");
  }
  return resolveSafeProjectPath(root, relativePath);
};

const isAlreadyExisting = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST";
