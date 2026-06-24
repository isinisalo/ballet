import type { AppData, CollectionName, EventRecord, MarkdownDocument } from "../../backend/shared/domain";

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const api = {
  getData: () => request<AppData>("/api/data"),
  reset: () => request<AppData>("/api/reset", { method: "POST" }),
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
  remove: (collection: CollectionName, id: string) =>
    request<void>(`/api/${collection}/${id}`, { method: "DELETE" }),
  intakeEvent: (event: Partial<EventRecord> & Pick<EventRecord, "projectId" | "eventType">) =>
    request<EventRecord>("/api/events/intake", {
      method: "POST",
      body: JSON.stringify(event)
    })
};
