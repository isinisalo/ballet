import type { CollectionName, EventRecord, MarkdownDocument, ProjectAutomationConfig } from "../../../shared/domain.js";

const collections: CollectionName[] = ["projects", "goals", "adrs", "agents", "skills"];
const collectionSet = new Set(collections);

export class HttpValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "HttpValidationError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const validateCollectionName = (value: string): CollectionName => {
  if (!collectionSet.has(value as CollectionName)) {
    throw new HttpValidationError("Unknown collection.", 404);
  }
  return value as CollectionName;
};

export const validateProjectDocumentSave = (body: unknown): Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body"> => {
  if (!isRecord(body)) {
    throw new HttpValidationError("relativePath, frontmatter object, and body are required.");
  }
  const { relativePath, frontmatter, body: markdownBody } = body;
  if (typeof relativePath !== "string" || !isRecord(frontmatter) || typeof markdownBody !== "string") {
    throw new HttpValidationError("relativePath, frontmatter object, and body are required.");
  }
  return { relativePath, frontmatter, body: markdownBody };
};

export const validateProjectDocumentCreate = (body: unknown): { directoryPath: string; title: string } => {
  if (!isRecord(body) || typeof body.directoryPath !== "string" || typeof body.title !== "string") {
    throw new HttpValidationError("directoryPath and title are required.");
  }
  return { directoryPath: body.directoryPath, title: body.title };
};

export const validateAutomationConfig = (body: unknown): ProjectAutomationConfig => {
  if (!isRecord(body) || body.version !== 1 || !Array.isArray(body.triggers) || !Array.isArray(body.policies) || !Array.isArray(body.workflows) || !Array.isArray(body.runtimes)) {
    throw new HttpValidationError("Automation config version, triggers, policies, workflows, and runtimes are required.");
  }
  return body as unknown as ProjectAutomationConfig;
};

export const validateEventIntake = (body: unknown): Partial<EventRecord> & Pick<EventRecord, "projectId" | "eventType"> => {
  if (!isRecord(body) || typeof body.projectId !== "string" || typeof body.eventType !== "string") {
    throw new HttpValidationError("projectId and eventType are required.");
  }
  return body as Partial<EventRecord> & Pick<EventRecord, "projectId" | "eventType">;
};

export const validateMutableItem = (body: unknown): Record<string, unknown> & { id?: string } => {
  if (!isRecord(body)) {
    throw new HttpValidationError("Request body object is required.");
  }
  if (body.id !== undefined && typeof body.id !== "string") {
    throw new HttpValidationError("id must be a string when provided.");
  }
  return body;
};
