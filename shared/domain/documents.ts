export type EntityStatus = "active" | "paused" | "archived";
export type AdrStatus = "proposed" | "accepted" | "superseded" | "rejected";

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

export interface Goal extends MarkdownBackedEntity {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "not-started" | "in-progress" | "at-risk" | "done";
  targetDate: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface Adr extends MarkdownBackedEntity {
  id: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  status: AdrStatus;
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
