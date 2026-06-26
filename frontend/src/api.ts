import type { AgentRun, AgentRunLog, AppData, CollectionName, EventDefinition, EventRecord, MarkdownDocument } from "backend/shared/domain";
import type { FlowComposerResult, FlowCreateDraft, FlowSettingsUpdateDraft, FlowTestResult, FlowViewModel, SafeDeleteResult, TraceViewModel, WorkspaceReference, WorkspaceValidationResult } from "backend/shared/flow";

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

const versionQuery = (version?: number): string =>
  version !== undefined ? `?version=${encodeURIComponent(String(version))}` : "";

export const api = {
  getData: () => request<AppData>("/api/data"),
  getWorkspaceValidation: () => request<WorkspaceValidationResult>("/api/workspace/validation"),
  checkSafeDelete: (target: WorkspaceReference) =>
    request<SafeDeleteResult>("/api/workspace/safe-delete", {
      method: "POST",
      body: JSON.stringify(target)
    }),
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
  remove: (collection: CollectionName, id: string, version?: number) =>
    request<void>(`/api/${collection}/${encodeURIComponent(id)}${version !== undefined ? `?version=${encodeURIComponent(String(version))}` : ""}`, { method: "DELETE" }),
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
  getFlows: () => request<FlowViewModel[]>("/api/flows"),
  getFlow: (flowId: string, version?: number) => request<FlowViewModel>(`/api/flows/${encodeURIComponent(flowId)}${versionQuery(version)}`),
  validateFlow: (draft: FlowCreateDraft) =>
    request<FlowComposerResult>("/api/flows/validate", {
      method: "POST",
      body: JSON.stringify(draft)
    }),
  createFlow: (draft: FlowCreateDraft) =>
    request<FlowViewModel>("/api/flows", {
      method: "POST",
      body: JSON.stringify(draft)
    }),
  updateFlow: (flowId: string, draft: FlowSettingsUpdateDraft, version?: number) =>
    request<FlowViewModel>(`/api/flows/${encodeURIComponent(flowId)}${versionQuery(version)}`, {
      method: "PUT",
      body: JSON.stringify(draft)
    }),
  testFlow: (flowId: string, payload: Record<string, unknown>, version?: number) =>
    request<FlowTestResult>(`/api/flows/${encodeURIComponent(flowId)}/test${versionQuery(version)}`, {
      method: "POST",
      body: JSON.stringify({ payload })
    }),
  activateFlow: (flowId: string, version?: number) => request<FlowViewModel>(`/api/flows/${encodeURIComponent(flowId)}/activate${versionQuery(version)}`, { method: "POST" }),
  pauseFlow: (flowId: string, version?: number) => request<FlowViewModel>(`/api/flows/${encodeURIComponent(flowId)}/pause${versionQuery(version)}`, { method: "POST" }),
  getAgentRuns: () => request<AgentRun[]>("/api/agent-runs"),
  retryAgentRun: (runId: string) => request<AgentRun>(`/api/agent-runs/${runId}/retry`, { method: "POST" }),
  getAgentRunLogs: (runId: string) => request<AgentRunLog[]>(`/api/agent-runs/${runId}/logs`),
  getRunTrace: (runId: string) => request<TraceViewModel>(`/api/traces/runs/${encodeURIComponent(runId)}`),
  getLoopTrace: (loopId: string) => request<TraceViewModel>(`/api/traces/loops/${encodeURIComponent(loopId)}`),
  getCorrelationTrace: (correlationId: string) => request<TraceViewModel>(`/api/traces/correlation/${encodeURIComponent(correlationId)}`),
  getRuntimeHealth: () => request<Record<string, unknown>>("/api/runtime/health")
};
