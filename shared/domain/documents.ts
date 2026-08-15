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

export type ProjectResourceOrigin = "project";
export type ProjectResourceKind = "instruction" | "skill";

export interface ProjectResourceIssue {
  kind: ProjectResourceKind;
  code: "invalid_utf8" | "invalid_frontmatter" | "invalid_id" | "duplicate_id" | "invalid_path" | "empty_content";
  relativePath: string;
  resourceId?: string;
  message: string;
}

export interface ProjectInstruction extends MarkdownBackedEntity {
  /** Origin-scoped runtime id. Missing when the source has no explicit frontmatter id. */
  id?: string;
  projectId?: string;
  title: string;
  body: string;
  relativePath: string;
  origin: ProjectResourceOrigin;
  valid: boolean;
  sourceSha256: string;
  contentSha256: string;
  sizeBytes: number;
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
  projectId: string;
  name: string;
  description: string;
  body: string;
  relativePath: string;
  metadata: Record<string, string>;
  origin: ProjectResourceOrigin;
  valid: boolean;
  sourceSha256: string;
  contentSha256: string;
  sizeBytes: number;
}

export interface ProjectResourceCatalog {
  instructions: ProjectInstruction[];
  skills: Skill[];
  issues: ProjectResourceIssue[];
}
