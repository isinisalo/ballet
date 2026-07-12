import type { AppData, CollectionName, WorkspaceSaveRequestByCollection } from "../../shared/api/workspace-contracts.js";
import type { MarkdownDocument } from "../../shared/domain/documents.js";
import { MarkdownEntityConflictError } from "../documents/MarkdownEntityErrors.js";
import { safeSlug } from "../markdown.js";
import {
  createProjectMarkdownDocument,
  removeEntityMarkdown,
  writeEntityMarkdown,
  writeProjectMarkdownDocument
} from "../markdown-adapter.js";

type MutableMarkdownCollection = CollectionName;

const markdownCollections = new Set<MutableMarkdownCollection>(["agents", "skills"]);

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
    item: WorkspaceSaveRequestByCollection[T]
  ): Promise<AppData[T][number]> {
    if (!markdownCollections.has(collection as MutableMarkdownCollection)) {
      throw new Error(`Unsupported collection: ${collection}`);
    }

    const data = await this.readData();
    const records = data[collection] as unknown as Array<Record<string, unknown>>;
    const existing = records.find((candidate) => candidate.id === item.id);
    if (item.id && !existing) {
      throw new MarkdownEntityConflictError(`${collection === "agents" ? "Agent" : "Skill"} '${item.id}' no longer exists.`);
    }
    const candidateId = safeSlug(typeof item.name === "string" ? item.name : collection);
    if (!existing && records.some((candidate) => candidate.id === candidateId)) {
      throw new MarkdownEntityConflictError(`${collection === "agents" ? "Agent" : "Skill"} '${candidateId}' already exists.`);
    }
    const nextInput = { ...existing, ...item } as Record<string, unknown>;
    const saved = await writeEntityMarkdown(
      this.root(),
      collection as MutableMarkdownCollection,
      nextInput,
      { existing }
    );
    const refreshed = await this.readData();
    return ((refreshed[collection] as unknown as Array<Record<string, unknown>>).find((candidate) => candidate.id === saved.id) ?? saved) as unknown as AppData[T][number];
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const data = await this.readData();
    const target = (data[collection] as unknown as Array<Record<string, unknown>>).find((item) => item.id === id);
    const relativePath = typeof target?.relativePath === "string" ? target.relativePath : undefined;
    if (!relativePath) return;
    await removeEntityMarkdown(this.root(), collection as MutableMarkdownCollection, relativePath);
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
