export type EntityStatus = "active" | "paused" | "archived";

export interface MarkdownDocument {
  id: string;
  collection: string;
  title?: string;
  frontmatter: Record<string, unknown>;
  body: string;
  absolutePath: string;
  relativePath: string;
  slug: string;
  errors?: string[];
}

export type ProjectDocumentTreeNode =
  | {
    type: "file";
    label: string;
    document: MarkdownDocument;
  }
  | {
    type: "directory";
    label: string;
    relativePath: string;
    children: ProjectDocumentTreeNode[];
  };

export interface MarkdownBackedEntity {
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface Project extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Skill extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  enabled?: boolean;
}
