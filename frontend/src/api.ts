import type {
  AppData,
  CollectionName,
  ExecutionProfile,
  ExecutionProfileSaveRequest,
  CanvasTheme,
  ProjectAutomationConfig,
  InstalledGraphNodeModuleStatus,
  GraphNodeModuleExportRequest,
  GraphNodeModuleExportResult,
  GraphNodeModuleInspectRequest,
  GraphNodeModuleInspection,
  GraphNodeModuleInstallCommitRequest,
  GraphNodeModuleInstallPlan,
  GraphNodeModuleInstallPlanRequest,
  GraphNodeModuleLibraryEntry,
  WorkspaceSaveRequestByCollection
} from "@shared/api/workspace-contracts";
import type { MarkdownDocument } from "@shared/api/workspace-contracts";
import { request } from "@/apiClient";

export const api = {
  getData: () => request<AppData>("/api/data"),
  createExecutionProfile: (id: string, profile: ExecutionProfileSaveRequest) =>
    request<ExecutionProfile>(`/api/execution-profiles/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify(profile)
    }),
  updateExecutionProfile: (id: string, profile: ExecutionProfileSaveRequest) =>
    request<ExecutionProfile>(`/api/execution-profiles/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(profile)
    }),
  removeExecutionProfile: (id: string) =>
    request<void>(`/api/execution-profiles/${encodeURIComponent(id)}`, { method: "DELETE" }),
  saveAutomation: (config: ProjectAutomationConfig) =>
    request<ProjectAutomationConfig>("/api/automation", {
      method: "PUT",
      body: JSON.stringify(config)
    }),
  listGraphNodeModuleLibrary: () => request<GraphNodeModuleLibraryEntry[]>("/api/graph-node-modules/library"),
  inspectGraphNodeModule: (input: GraphNodeModuleInspectRequest) =>
    request<GraphNodeModuleInspection>("/api/graph-node-modules/inspect", { method: "POST", body: JSON.stringify(input) }),
  planGraphNodeModuleInstall: (input: GraphNodeModuleInstallPlanRequest) =>
    request<GraphNodeModuleInstallPlan>("/api/graph-node-modules/install-plan", { method: "POST", body: JSON.stringify(input) }),
  installGraphNodeModule: (input: GraphNodeModuleInstallCommitRequest) =>
    request<InstalledGraphNodeModuleStatus>("/api/graph-node-modules/install", { method: "POST", body: JSON.stringify(input) }),
  exportGraphNodeModule: (input: GraphNodeModuleExportRequest) =>
    request<GraphNodeModuleExportResult>("/api/graph-node-modules/export", { method: "POST", body: JSON.stringify(input) }),
  graphNodeModuleStatuses: () => request<InstalledGraphNodeModuleStatus[]>("/api/graph-node-modules/status"),
  removeInstalledGraphNodeModule: (graphNodeId: string) =>
    request<void>(`/api/graph-node-modules/installed/${encodeURIComponent(graphNodeId)}`, { method: "DELETE" }),
  updateCanvasTheme: (theme: CanvasTheme) =>
    request<CanvasTheme>("/api/canvas-theme", {
      method: "PUT",
      body: JSON.stringify(theme)
    }),
  save: <T extends CollectionName>(collection: T, item: WorkspaceSaveRequestByCollection[T]) =>
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
    request<void>(`/api/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" })
};
