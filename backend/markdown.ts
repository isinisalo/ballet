import { constants, type Dirent } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument, stringify } from "yaml";
import type { MarkdownDocument, ProjectDocumentTreeNode } from "../shared/domain/documents.js";
import { resolveSafeProjectPath } from "./documents/safeProjectPath.js";

export { assertInsideRoot } from "./documents/safeProjectPath.js";

export type ParsedMarkdownDocument = { frontmatter: Record<string, unknown>; body: string; errors?: string[] };
export type ReadMarkdownCollectionOptions = {
  root: string; collectionPath: string; collection?: string; extensions?: string[];
};
export type ReadMarkdownDocumentOptions = { root: string; relativePath: string; collection?: string };

export const getProjectRoot = (): string => path.resolve(process.cwd());

const defaultExtensions = [".md", ".mdx"];
const projectTreeExtensions = [".md"];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";

const normalizeRelativePath = (relativePath: string): string => relativePath.split(path.sep).join("/");

const readDirectory = async (absolutePath: string): Promise<Dirent[]> => {
  try {
    return await readdir(absolutePath, { withFileTypes: true });
  } catch (error) {
    if (isMissingDirectory(error)) return [];
    throw error;
  }
};

const isMissingDirectory = (error: unknown): boolean =>
  error instanceof Error
  && "code" in error
  && ["ENOENT", "ENOTDIR"].includes(String((error as NodeJS.ErrnoException).code));

const projectDocumentLabel = (document: MarkdownDocument): string =>
  document.title
  || (typeof document.frontmatter.title === "string" ? document.frontmatter.title : undefined)
  || (typeof document.frontmatter.name === "string" ? document.frontmatter.name : undefined)
  || document.slug
  || document.id;

const toPlainFrontmatter = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export const parseMarkdownDocument = (source: string): ParsedMarkdownDocument => {
  if (!source.startsWith("---")) return { frontmatter: {}, body: source };

  const separatorMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!separatorMatch) return { frontmatter: {}, body: source, errors: ["Opening frontmatter marker was found, but no closing marker exists."] };

  const yamlSource = separatorMatch[1];
  const body = source.slice(separatorMatch[0].length);
  const document = parseDocument(yamlSource, { prettyErrors: false });
  const errors = document.errors.map((error) => error.message);

  if (errors.length > 0) {
    return { frontmatter: {}, body, errors };
  }

  const parsed = document.toJSON();
  if (parsed !== null && (!isMap(document.contents) || typeof parsed !== "object" || Array.isArray(parsed))) {
    return { frontmatter: {}, body, errors: ["Frontmatter must be a YAML mapping/object."] };
  }

  return { frontmatter: toPlainFrontmatter(parsed), body };
};

export const readMarkdownDocument = async ({ root, relativePath, collection }: ReadMarkdownDocumentOptions): Promise<MarkdownDocument> => {
  const absolutePath = await resolveSafeProjectPath(root, relativePath);
  if (!defaultExtensions.includes(path.extname(relativePath).toLowerCase())) {
    throw new Error(`Unsupported Markdown extension for ${relativePath}`);
  }

  const source = await readFile(absolutePath, { encoding: "utf8", flag: constants.O_RDONLY | constants.O_NOFOLLOW });
  const parsed = parseMarkdownDocument(source);
  const normalizedRelativePath = normalizeRelativePath(path.relative(path.resolve(root), absolutePath));
  const slug = slugify(path.basename(normalizedRelativePath, path.extname(normalizedRelativePath)));
  const frontmatterId = typeof parsed.frontmatter.id === "string" ? parsed.frontmatter.id : undefined;
  const title = typeof parsed.frontmatter.title === "string"
    ? parsed.frontmatter.title
    : typeof parsed.frontmatter.name === "string"
      ? parsed.frontmatter.name
      : undefined;

  return {
    id: frontmatterId || slug,
    collection: collection ?? normalizedRelativePath.split("/").slice(0, -1).join("/"),
    title,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    absolutePath,
    relativePath: normalizedRelativePath,
    slug,
    errors: parsed.errors
  };
};

export const readMarkdownCollection = async ({
  root,
  collectionPath,
  collection = collectionPath,
  extensions = defaultExtensions
}: ReadMarkdownCollectionOptions): Promise<MarkdownDocument[]> => {
  const absoluteCollectionPath = await resolveSafeProjectPath(root, collectionPath);

  const entries = await readDirectory(absoluteCollectionPath);
  const extensionSet = new Set(extensions.map((extension) => extension.toLowerCase()));
  const files = entries
    .filter((entry) => entry.isFile() && extensionSet.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => normalizeRelativePath(path.join(collectionPath, entry.name)))
    .sort((a, b) => {
      if (a.endsWith("/project.md")) return -1;
      if (b.endsWith("/project.md")) return 1;
      return a.localeCompare(b);
    });

  return Promise.all(files.map((relativePath) => readMarkdownDocument({ root, relativePath, collection })));
};

const sortProjectEntries = (a: string, b: string): number => {
  if (a === ".ballet/project.md") return -1;
  if (b === ".ballet/project.md") return 1;
  return a.localeCompare(b);
};

const readBalletProjectDirectory = async (
  root: string,
  relativePath: string,
  depth: number
): Promise<ProjectDocumentTreeNode[]> => {
  const absolutePath = await resolveSafeProjectPath(root, relativePath);

  const entries = await readDirectory(absolutePath);
  const files = entries
    .filter((entry) => entry.isFile() && projectTreeExtensions.includes(path.extname(entry.name).toLowerCase()))
    .map((entry) => normalizeRelativePath(path.join(relativePath, entry.name)))
    .sort(sortProjectEntries);
  const directories = depth < 2
    ? entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        label: entry.name,
        relativePath: normalizeRelativePath(path.join(relativePath, entry.name))
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  const fileNodes = await Promise.all(files.map(async (filePath): Promise<ProjectDocumentTreeNode> => {
    const document = await readMarkdownDocument({ root, relativePath: filePath, collection: "project" });
    return {
      type: "file",
      label: projectDocumentLabel(document),
      document
    };
  }));

  const directoryNodes = await Promise.all(directories.map(async (directory): Promise<ProjectDocumentTreeNode> => ({
    type: "directory",
    label: directory.label,
    relativePath: directory.relativePath,
    children: await readBalletProjectDirectory(root, directory.relativePath, depth + 1)
  })));

  return [...fileNodes, ...directoryNodes];
};

export const loadBalletProjectTree = (root: string): Promise<ProjectDocumentTreeNode[]> => readBalletProjectDirectory(root, ".ballet", 0);
export const loadBalletProject = async (root: string): Promise<MarkdownDocument[]> => {
  try {
    return [await readMarkdownDocument({ root, relativePath: ".ballet/project.md", collection: "project" })];
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};
export const safeSlug = slugify;

export const markdownSource = (frontmatter: Record<string, unknown>, body: string): string => {
  const yaml = stringify(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
};

export const writeMarkdownDocument = async ({
  root,
  relativePath,
  frontmatter,
  body,
  exclusive = false
}: {
  root: string;
  relativePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
  exclusive?: boolean;
}): Promise<void> => {
  const absolutePath = await resolveSafeProjectPath(root, relativePath);
  if (!defaultExtensions.includes(path.extname(relativePath).toLowerCase())) {
    throw new Error(`Unsupported Markdown extension for ${relativePath}`);
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const flag = constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW
    | (exclusive ? constants.O_EXCL : constants.O_TRUNC);
  await writeFile(absolutePath, markdownSource(frontmatter, body), { encoding: "utf8", flag });
};
