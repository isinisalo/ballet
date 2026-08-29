import { request } from "@/apiClient";
import type { Constraint, DirectionReference, UseCase } from "@shared/vnext/direction";
import type { ActionDefinition, EnvironmentDefinition, ProjectConfigurationV20, StateDefinition } from "@shared/vnext/environment";
import type { ProjectRecord, ReferenceIndexResponse, ResourceDocument } from "./types";

const base = "/api/vnext";
const body = (value: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(value) });
const put = (value: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(value) });
const remove = (value: unknown): RequestInit => ({ method: "DELETE", body: JSON.stringify(value) });

export const vNextApi = {
  project: () => request<ProjectRecord>(`${base}/project`),
  references: () => request<ReferenceIndexResponse>(`${base}/reference-index`),
  resources: (collection: "goals" | "adrs" | "constraints" | "use-cases" | "instructions" | "skills") => request<ResourceDocument[]>(`${base}/${collection}`),
  schedules: () => request<Array<Record<string, unknown>>>(`${base}/critic/schedules`),
  putProject: (config: ProjectConfigurationV20, expectedHash: string) => request<ProjectRecord>(`${base}/project`, put({ config, expectedHash })),
  saveDirection: (collection: "goals" | "adrs" | "constraints" | "use-cases", value: DirectionReference | Constraint | UseCase,
    markdown: string, expectedConfigHash: string, expectedDocumentHash: string | "absent", creating = false) =>
    request(`${base}/${collection}${creating ? "" : `/${encodeURIComponent(value.id)}`}`, {
      ...(creating ? body({ value, markdown, expectedConfigHash, expectedDocumentHash }) : put({ value, markdown, expectedConfigHash, expectedDocumentHash }))
    }),
  deleteDirection: (collection: string, id: string, expectedConfigHash: string, expectedHash: string) =>
    request(`${base}/${collection}/${encodeURIComponent(id)}`, remove({ expectedConfigHash, expectedHash })),
  approveUseCase: (id: string, expectedConfigHash: string) => request(`${base}/use-cases/${encodeURIComponent(id)}/approve`, body({ expectedConfigHash })),
  returnUseCaseToDraft: (id: string, expectedConfigHash: string) => request(`${base}/use-cases/${encodeURIComponent(id)}/return-to-draft`, body({ expectedConfigHash })),
  saveEnvironment: (environment: EnvironmentDefinition, expectedConfigHash: string) => request(`${base}/environment`, put({ environment, expectedConfigHash })),
  createState: (state: StateDefinition, expectedConfigHash: string) => request(`${base}/environment/states`, body({ state, expectedConfigHash })),
  updateState: (state: StateDefinition, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(state.id)}`, put({ state, expectedConfigHash })),
  reorderStates: (orderedIds: string[], expectedConfigHash: string) => request(`${base}/environment/states/reorder`, body({ orderedIds, expectedConfigHash })),
  createAction: (stateId: string, action: ActionDefinition, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions`, body({ action, expectedConfigHash })),
  updateAction: (stateId: string, action: ActionDefinition, expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/${encodeURIComponent(action.id)}`, put({ action, expectedConfigHash })),
  reprioritizeActions: (stateId: string, orderedIds: string[], expectedConfigHash: string) => request(`${base}/environment/states/${encodeURIComponent(stateId)}/actions/reprioritize`, body({ orderedIds, expectedConfigHash })),
  saveResource: (collection: "instructions" | "skills", id: string, content: string, expectedHash: string | "absent", creating = false) =>
    request(`${base}/${collection}${creating ? "" : `/${encodeURIComponent(id)}`}`, creating ? body({ id, content, expectedHash }) : put({ content, expectedHash })),
  manualCritic: () => request(`${base}/critic/runs`, body({}))
};

export const vNextApiBase = base;
