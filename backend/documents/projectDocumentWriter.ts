import path from "node:path";
import { mkdir, stat } from "node:fs/promises";
import type { MarkdownDocument } from "../../shared/domain/documents.js";
import { assertInsideRoot, readMarkdownDocument, safeSlug, writeMarkdownDocument } from "../markdown.js";

const now = () => new Date().toISOString();

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
