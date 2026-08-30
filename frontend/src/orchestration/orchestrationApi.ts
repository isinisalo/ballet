import { request } from "@/apiClient";
import type { Constraint, DirectionReference, UseCase } from "@shared/orchestration/direction";
import type { ActionDefinition, EnvironmentDefinition, GovernanceAgentId, ProjectConfigurationV23, StateDefinition } from "@shared/orchestration/environment";
import type { GovernanceAgentsResponse, GovernanceAgentSlot, ProjectRecord, ReferenceIndexResponse, ResourceDocument } from "./types";
import type { JsonRow, RunDetail, RunSummary } from "./runTypes";
import type { ActionExecutionBinding, ActionRoleModelSelection, LocalDaemonLogEntry, LocalDaemonStatus } from "@shared/domain/runtime";

const base = "/api";
const body = (value: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(value) });
const put = (value: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(value) });
const remove = (value: unknown): RequestInit => ({ method: "DELETE", body: JSON.stringify(value) });

export const orchestrationApi = {
  project: () => request<ProjectRecord>(`${base}/project`),
  references: () => request<ReferenceIndexResponse>(`${base}/reference-index`),
  resources: (collection: "goals" | "adrs" | "constraints" | "use-cases" | "instructions" | "skills") => request<ResourceDocument[]>(`${base}/${collection}`),
  agents: () => request<GovernanceAgentsResponse>(`${base}/agents`),
  agent: (id: GovernanceAgentId) => request<GovernanceAgentSlot & { configHash: string }>(`${base}/agents/${encodeURIComponent(id)}`),
  schedules: () => request<Array<Record<string, unknown>>>(`${base}/critic/schedules`),
  putProject: (config: ProjectConfigurationV23, expectedHash: string) => request<ProjectRecord>(`${base}/project`, put({ config, expectedHash })),
  saveDirection: (collection: "goals" | "adrs" | "constraints" | "use-cases", value: DirectionReference | Constraint | UseCase,
    markdown: string, expectedConfigHash: string, expectedDocumentHash: string | "absent", creating = false) =>
    request(`${base}/${collection}${creating ? "" : `/${encodeURIComponent(value.id)}`}`, {
      ...(creating ? body({ value, markdown, expectedConfigHash, expectedDocumentHash }) : put({ value, markdown, expectedConfigHash, expectedDocumentHash }))
    }),
  deleteDirection: (collection: string, id: string, expectedConfigHash: string, expectedHash: string) =>
    request(`${base}/${collection}/${encodeURIComponent(id)}`, remove({ expectedConfigHash, expectedHash })),
  saveAgent: (id: GovernanceAgentId, input: { developerInstructions: string; model: string; reasoningEffort: string;
    skillResources: string[]; expectedConfigHash: string; expectedDocumentHash: string }) =>
    request(`${base}/agents/${encodeURIComponent(id)}`, put(input)),
  localRuntime: () => request<LocalDaemonStatus>(`${base}/runtimes/local`),
  refreshRuntime: () => request<LocalDaemonStatus>(`${base}/runtimes/local/refresh`, body({})),
  restartRuntime: () => request<LocalDaemonStatus>(`${base}/runtimes/local/restart`, body({})),
  runtimeLogs: (limit = 200) => request<{ entries: LocalDaemonLogEntry[] }>(`${base}/runtimes/local/logs?limit=${limit}`),
  actionBinding: (stateId: string, actionId: string) =>
    request<ActionExecutionBinding | null>(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/${encodeURIComponent(actionId)}/execution`),
  saveActionBinding: (stateId: string, actionId: string, input: {
    validation: ActionRoleModelSelection; work: ActionRoleModelSelection }) =>
    request<ActionExecutionBinding>(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/${encodeURIComponent(actionId)}/execution`, put(input)),
  approveUseCase: (id: string, expectedConfigHash: string, expectedContentHash: string) => request(
    `${base}/use-cases/${encodeURIComponent(id)}/approve`, body({ expectedConfigHash, expectedContentHash })),
  returnUseCaseToDraft: (id: string, expectedConfigHash: string) => request(`${base}/use-cases/${encodeURIComponent(id)}/return-to-draft`, body({ expectedConfigHash })),
  saveEnvironment: (environment: EnvironmentDefinition, expectedConfigHash: string) => request(`${base}/environment`, put({ environment, expectedConfigHash })),
  createState: (state: StateDefinition, expectedConfigHash: string) => request(`${base}/environment/states`, body({ state, expectedConfigHash })),
  updateState: (state: StateDefinition, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(state.id)}`, put({ state, expectedConfigHash })),
  deleteState: (stateId: string, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}`, remove({ expectedConfigHash })),
  reorderStates: (orderedIds: string[], expectedConfigHash: string) => request(`${base}/environment/states/reorder`, body({ orderedIds, expectedConfigHash })),
  createAction: (stateId: string, action: ActionDefinition, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions`, body({ action, expectedConfigHash })),
  updateAction: (stateId: string, action: ActionDefinition, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/${encodeURIComponent(action.id)}`, put({ action, expectedConfigHash })),
  deleteAction: (stateId: string, actionId: string, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/${encodeURIComponent(actionId)}`, remove({ expectedConfigHash })),
  reprioritizeActions: (stateId: string, orderedIds: string[], expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/reprioritize`, body({ orderedIds, expectedConfigHash })),
  saveResource: (collection: "instructions" | "skills", id: string, content: string, expectedHash: string | "absent", creating = false) =>
    request(`${base}/${collection}${creating ? "" : `/${encodeURIComponent(id)}`}`, creating ? body({ id, content, expectedHash }) : put({ content, expectedHash })),
  manualCritic: () => request(`${base}/critic/runs`, body({})),
  runs: () => request<RunSummary[]>(`${base}/environment-runs`),
  run: (id: string) => request<RunDetail>(`${base}/environment-runs/${encodeURIComponent(id)}`),
  startRun: (environmentId: string, expectedConfigHash: string, input?: string) => request<RunSummary>(`${base}/environment-runs`, body({ environmentId, expectedConfigHash, ...(input ? { input } : {}) })),
  cancelRun: (id: string) => request<RunSummary>(`${base}/environment-runs/${encodeURIComponent(id)}/cancel`, body({})),
  answerWorkInput: (id: string, expectedAgentRunId: string, expectedAgentRevision: number, answer: string) => request<RunSummary>(
    `${base}/environment-runs/${encodeURIComponent(id)}/work-input`, body({ expectedAgentRunId, expectedAgentRevision, answer })),
  evidence: (runId: string) => request<JsonRow>(`${base}/environment-runs/${encodeURIComponent(runId)}/evidence`),
  feedback: (query = "") => request<JsonRow[]>(`${base}/feedback${query}`),
  feedbackDetail: (id: string) => request<JsonRow>(`${base}/feedback/${encodeURIComponent(id)}`),
  createFeedback: (input: JsonRow) => request<JsonRow>(`${base}/feedback`, body(input)),
  decideFeedback: (id: string, from: "open" | "in_refinement", decision: "resolved" | "dismissed") => request(`${base}/feedback/${encodeURIComponent(id)}/decision`, body({ from, decision })),
  criticRuns: () => request<JsonRow[]>(`${base}/critic/runs`),
  criticProposals: () => request<JsonRow[]>(`${base}/critic/proposals`),
  criticProposal: (id: string) => request<JsonRow>(`${base}/critic/proposals/${encodeURIComponent(id)}`),
  decideCritic: (id: string, input: JsonRow) => request(`${base}/critic/proposals/${encodeURIComponent(id)}/decision`, body(input)),
  refinementRuns: () => request<JsonRow[]>(`${base}/refinement/runs`),
  refinementProposals: () => request<JsonRow[]>(`${base}/refinement/proposals`),
  refinementProposal: (id: string) => request<JsonRow>(`${base}/refinement/proposals/${encodeURIComponent(id)}`),
  createRefinement: (feedbackEntryId: string) => request(`${base}/feedback/${encodeURIComponent(feedbackEntryId)}/refinement`, body({})),
  decideRefinement: (id: string, input: JsonRow) => request(`${base}/refinement/proposals/${encodeURIComponent(id)}/decision`, body(input)),
  applyRefinement: (id: string) => request(`${base}/refinement/proposals/${encodeURIComponent(id)}/apply`, body({})),
  applyStatus: (id: string) => request<JsonRow>(`${base}/refinement/proposals/${encodeURIComponent(id)}/apply`),
  continuation: (id: string) => request<JsonRow>(`${base}/refinement/proposals/${encodeURIComponent(id)}/continuation`)
};

export const orchestrationApiBase = base;
