import type { AppData, CollectionName } from "../../shared/api/workspaceData.js";
import type { MarkdownDocument } from "../../shared/domain/documents.js";
import {
  createProjectMarkdownDocument,
  removeEntityMarkdown,
  writeEntityMarkdown,
  writeProjectMarkdownDocument
} from "../markdown-adapter.js";

type MutableMarkdownCollection = Exclude<CollectionName, "events" | "runtimes" | "policies">;

const markdownCollections = new Set<MutableMarkdownCollection>(["projects", "goals", "adrs", "agents", "skills"]);

export class MarkdownEntityService {
  constructor(
    private readonly root: () => string,
    private readonly readData: () => Promise<AppData>
  ) {}

  async list<T extends CollectionName>(collection: T): Promise<AppData[T]> {
    const data = await this.readData();
    return data[collection];
  }

  async upsert<T extends CollectionName>(
    collection: T,
    item: Partial<AppData[T][number]> & { id?: string }
  ): Promise<AppData[T][number]> {
    if (!markdownCollections.has(collection as MutableMarkdownCollection)) {
      throw new Error(`Unsupported collection: ${collection}`);
    }

    const data = await this.readData();
    const existing = (data[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === item.id);
    const nextInput = { ...existing, ...item } as Record<string, unknown>;
    const saved = await writeEntityMarkdown(this.root(), collection as MutableMarkdownCollection, nextInput);
    const refreshed = await this.readData();
    return ((refreshed[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === saved.id) ?? saved) as unknown as AppData[T][number];
  }

  async remove(collection: CollectionName, id: string): Promise<boolean> {
    if (collection === "events") return false;
    const data = await this.readData();
    const target = (data[collection] as unknown as Array<Record<string, unknown>>).find((item) => item.id === id);
    const relativePath = typeof target?.relativePath === "string" ? target.relativePath : undefined;
    if (!relativePath) return true;
    await removeEntityMarkdown(this.root(), relativePath);
    return true;
  }

  async saveProjectDocument(input: {
    relativePath: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }): Promise<MarkdownDocument> {
    return writeProjectMarkdownDocument(this.root(), input);
  }

  async createProjectDocument(input: {
    directoryPath: string;
    title: string;
  }): Promise<MarkdownDocument> {
    return createProjectMarkdownDocument(this.root(), input);
  }
}
