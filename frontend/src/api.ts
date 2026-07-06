import type { AppData, CollectionName } from "../../shared/api/workspace-contracts";
import type { ProjectAutomationConfig } from "../../shared/api/workspace-contracts";
import type { MarkdownDocument } from "../../shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";

type ErrorResponseBody = {
  error?: string;
  issues?: Array<{ path?: string; message?: string }>;
};

const parseJsonBody = async <T,>(response: Response): Promise<T | undefined> => {
  const text = await response.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Request failed with ${response.status}: ${toErrorMessage(error, "Invalid error response.")}`);
  }
};

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  if (!response.ok) {
    const body = (await parseJsonBody<ErrorResponseBody>(response)) ?? {};
    const issueMessage = body.issues
      ?.map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; ");
    throw new Error(issueMessage ? `${body.error ?? `Request failed with ${response.status}`}: ${issueMessage}` : body.error ?? `Request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await parseJsonBody<T>(response)) as T;
};

export const api = {
  getData: () => request<AppData>("/api/data"),
  saveAutomation: (config: ProjectAutomationConfig) =>
    request<ProjectAutomationConfig>("/api/automation", {
      method: "PUT",
      body: JSON.stringify(config)
    }),
  save: <T extends CollectionName>(collection: T, item: Partial<AppData[T][number]>) =>
    request<AppData[T][number]>(`/api/${collection}`, {
      method: "POST",
      body: JSON.stringify(item)
    }),
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) =>
    request<MarkdownDocument>("/api/project-documents", {
      method: "POST",
      body: JSON.stringify(document)
    }),
  createProjectDocument: (document: { directoryPath: string; title: string }) =>
    request<MarkdownDocument>("/api/project-documents/create", {
      method: "POST",
      body: JSON.stringify(document)
    }),
  remove: (collection: CollectionName, id: string) =>
    request<void>(`/api/${collection}/${id}`, { method: "DELETE" })
};
