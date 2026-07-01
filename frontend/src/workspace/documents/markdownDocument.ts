import type { Adr, Goal, MarkdownDocument, Project, Skill } from "../../../../shared/domain/documents";

export type MarkdownEntity = Pick<Project | Goal | Adr | MarkdownDocument | Skill, "id" | "frontmatter" | "body" | "relativePath" | "errors"> & {
  createdAt?: string;
  updatedAt?: string;
  name?: string;
  title?: string;
  status?: string;
  targetDate?: string;
  owner?: string;
};

export const documentTitle = (document: MarkdownEntity) =>
  document.title || document.name || (typeof document.frontmatter?.title === "string" ? document.frontmatter.title : undefined) || document.id;

export const normalizeHeadingText = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const removeMatchingLeadingH1 = (source: string, title?: string) => {
  if (!title) return source;
  return source.replace(/^#\s+(.+?)\s*\n+/, (match, heading: string) =>
    normalizeHeadingText(heading) === normalizeHeadingText(title) ? "" : match
  );
};

export const markdownPreviewDocument = (
  document: MarkdownEntity,
  frontmatterText: string,
  bodyText: string,
  parseFrontmatter: (value: string) => Record<string, unknown>
): MarkdownEntity => {
  try {
    return {
      ...document,
      frontmatter: parseFrontmatter(frontmatterText),
      body: bodyText,
      errors: []
    };
  } catch (error) {
    return {
      ...document,
      body: bodyText,
      errors: [error instanceof Error ? error.message : "Invalid YAML frontmatter."]
    };
  }
};
