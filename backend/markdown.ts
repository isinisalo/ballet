import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument, stringify } from "yaml";
import type { MarkdownDocument } from "./shared/domain.js";

export interface ParsedMarkdownDocument {
  frontmatter: Record<string, unknown>;
  body: string;
  errors?: string[];
}

export interface ReadMarkdownCollectionOptions {
  root: string;
  collectionPath: string;
  collection?: string;
  extensions?: string[];
}

export interface ReadMarkdownDocumentOptions {
  root: string;
  relativePath: string;
  collection?: string;
}

export const getProjectRoot = (): string => path.resolve(process.cwd());

const defaultExtensions = [".md", ".mdx"];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";

const normalizeRelativePath = (relativePath: string): string => relativePath.split(path.sep).join("/");

export const assertInsideRoot = (root: string, target: string): string => {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path traversal blocked: ${target}`);
  }
  return resolvedTarget;
};

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
  const absolutePath = assertInsideRoot(root, relativePath);
  if (!defaultExtensions.includes(path.extname(relativePath).toLowerCase())) {
    throw new Error(`Unsupported Markdown extension for ${relativePath}`);
  }

  const source = await readFile(absolutePath, "utf8");
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
  const absoluteCollectionPath = assertInsideRoot(root, collectionPath);

  try {
    const stats = await stat(absoluteCollectionPath);
    if (!stats.isDirectory()) return [];
  } catch {
    return [];
  }

  const entries = await readdir(absoluteCollectionPath, { withFileTypes: true });
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

export const loadAgents = (root: string) => readMarkdownCollection({ root, collectionPath: ".codex/agents", collection: "agents" });
export const loadBalletProject = async (root: string): Promise<MarkdownDocument[]> => {
  try {
    return [await readMarkdownDocument({ root, relativePath: ".ballet/project.md", collection: "project" })];
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};
export const loadAdr = (root: string) => readMarkdownCollection({ root, collectionPath: ".ballet/adr", collection: "adr" });
export const loadGoals = (root: string) => readMarkdownCollection({ root, collectionPath: ".ballet/goals", collection: "goals" });
export const loadEvents = (root: string) => readMarkdownCollection({ root, collectionPath: ".ballet/events", collection: "events" });
export const loadPolicies = (root: string) => readMarkdownCollection({ root, collectionPath: ".ballet/policies", collection: "policies" });

export const safeSlug = slugify;

export const markdownSource = (frontmatter: Record<string, unknown>, body: string): string => {
  const yaml = stringify(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trimStart()}`;
};

export const writeMarkdownDocument = async ({
  root,
  relativePath,
  frontmatter,
  body
}: {
  root: string;
  relativePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}): Promise<void> => {
  const absolutePath = assertInsideRoot(root, relativePath);
  if (!defaultExtensions.includes(path.extname(relativePath).toLowerCase())) {
    throw new Error(`Unsupported Markdown extension for ${relativePath}`);
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, markdownSource(frontmatter, body), "utf8");
};
