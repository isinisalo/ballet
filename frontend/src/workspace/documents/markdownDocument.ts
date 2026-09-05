export interface MarkdownEntity {
  id: string;
  frontmatter?: Record<string, unknown>;
  name?: string;
  title?: string;
}

export const documentTitle = (document: MarkdownEntity) =>
  document.title
  || document.name
  || (typeof document.frontmatter?.title === "string" ? document.frontmatter.title : undefined)
  || (typeof document.frontmatter?.name === "string" ? document.frontmatter.name : undefined)
  || document.id;
