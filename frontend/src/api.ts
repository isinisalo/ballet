import type { AgentRun, AgentRunLog, AppData, CollectionName, EventDefinition, EventRecord, MarkdownDocument } from "../../backend/shared/domain";

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
  saveEventDefinition: (eventDefinition: Partial<EventDefinition>) =>
    request<EventDefinition>("/api/event-definitions", {
      method: "POST",
      body: JSON.stringify(eventDefinition)
    }),
  removeEventDefinition: (id: string) =>
    request<void>(`/api/event-definitions/${id}`, { method: "DELETE" }),
  intakeEvent: (event: Partial<EventRecord> & Pick<EventRecord, "projectId" | "eventType">) =>
    request<EventRecord>("/api/events/intake", {
      method: "POST",
      body: JSON.stringify(event)
    }),
  dryRunRoutingPolicy: (policyId: string, event: Partial<EventRecord> & Pick<EventRecord, "eventType">) =>
    request<unknown>(`/api/routing-policies/${encodeURIComponent(policyId)}/dry-run`, {
      method: "POST",
      body: JSON.stringify(event)
    }),
  dryRunEmissionPolicy: (policyId: string, input: { operationInput?: unknown; operationOutput?: unknown }) =>
    request<unknown>(`/api/emission-policies/${encodeURIComponent(policyId)}/dry-run`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getAgentRuns: () => request<AgentRun[]>("/api/agent-runs"),
  retryAgentRun: (runId: string) => request<AgentRun>(`/api/agent-runs/${runId}/retry`, { method: "POST" }),
  getAgentRunLogs: (runId: string) => request<AgentRunLog[]>(`/api/agent-runs/${runId}/logs`),
  getRuntimeHealth: () => request<Record<string, unknown>>("/api/runtime/health")
};
