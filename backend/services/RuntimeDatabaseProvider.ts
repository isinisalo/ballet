import path from "node:path";
import { readFileSync } from "node:fs";
import { RuntimeDatabase, resolveRuntimeDbPath } from "../runtime-db.js";
import { parseMarkdownDocument } from "../markdown.js";

const resolveProjectId = (root: string): string => {
  const configured = process.env.BALLET_PROJECT_ID?.trim();
  if (configured) return configured;
  try {
    const parsed = parseMarkdownDocument(readFileSync(path.join(root, ".ballet", "project.md"), "utf8"));
    if (typeof parsed.frontmatter.id === "string" && parsed.frontmatter.id.trim()) return parsed.frontmatter.id.trim();
  } catch {
    // A repository without project.md uses its checkout directory as the local project id.
  }
  return path.basename(root);
};

export class RuntimeDatabaseProvider {
  private runtimeDb?: RuntimeDatabase;
  private runtimeDbPath?: string;
  private projectId?: string;

  constructor(private readonly root: () => string) {}

  runtimeDatabase(): RuntimeDatabase {
    const dbPath = resolveRuntimeDbPath(this.root());
    const projectId = resolveProjectId(this.root());
    if (!this.runtimeDb || this.runtimeDbPath !== dbPath || this.projectId !== projectId) {
      this.runtimeDb?.close();
      this.runtimeDb = new RuntimeDatabase(dbPath, projectId);
      this.runtimeDbPath = dbPath;
      this.projectId = projectId;
    }
    return this.runtimeDb;
  }
}
