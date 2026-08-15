import path from "node:path";
import { unlink } from "node:fs/promises";
import { safeSlug, writeMarkdownDocument } from "../markdown.js";
import { MarkdownEntityConflictError, MarkdownEntityValidationError } from "./MarkdownEntityErrors.js";
import { assertInsideRoot, resolveSafeProjectPath } from "./safeProjectPath.js";
import { recordValue, stringValue } from "./documentValues.js";

export type EntityMarkdownCollection = "skills";
const skillRoot = ".agents/skills";

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
  const existingPath = stringValue(existing?.relativePath ?? item.relativePath);
  if (existingPath) await resolveEntityPath(root, collection, existingPath);
  const relativePath = existingPath || path.posix.join(skillRoot, safeSlug(stringValue(item.name, "skill")), "SKILL.md");
  await resolveEntityPath(root, collection, relativePath);
  const frontmatter = skillFrontmatter(item, existing);
  const exclusive = !existing;
  try {
    await writeMarkdownDocument({ root, relativePath, frontmatter, body: stringValue(item.body), exclusive });
  } catch (error) {
    if (isAlreadyExisting(error)) throw new MarkdownEntityConflictError(`Skill '${projectSkillId(relativePath)}' already exists.`);
    throw error;
  }
  const projectId = projectSkillId(relativePath);
  return {
    ...existing,
    ...item,
    id: `project:${projectId}`,
    projectId,
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
  _collection: EntityMarkdownCollection,
  relativePath: string
): Promise<string> => {
  const absolutePath = assertInsideRoot(root, relativePath);
  const collectionRoot = assertInsideRoot(root, skillRoot);
  const relativeToCollection = path.relative(collectionRoot, absolutePath);
  if (!relativeToCollection || relativeToCollection.startsWith("..") || path.isAbsolute(relativeToCollection)) {
    throw new MarkdownEntityValidationError(`Entity document must be inside ${skillRoot}.`);
  }
  if (path.basename(absolutePath) !== "SKILL.md") {
    throw new MarkdownEntityValidationError("Skill document must be named SKILL.md.");
  }
  const projectId = projectSkillId(relativePath);
  if (projectId.split("/").some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment))) {
    throw new MarkdownEntityValidationError("Skill directory path segments must be lowercase kebab-case.");
  }
  return resolveSafeProjectPath(root, relativePath);
};

const projectSkillId = (relativePath: string): string => path.posix.dirname(relativePath)
  .replace(/^\.agents\/skills\/?/, "");

const isAlreadyExisting = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST";
