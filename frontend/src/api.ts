import type {
  AppData,
  CollectionName,
  ExecutionProfile,
  ExecutionProfileSaveRequest,
  LoopTheme,
  ProjectAutomationConfig,
  InstalledLoopModuleStatus,
  LoopModuleExportRequest,
  LoopModuleExportResult,
  LoopModuleInspectRequest,
  LoopModuleInspection,
  LoopModuleInstallCommitRequest,
  LoopModuleInstallPlan,
  LoopModuleInstallPlanRequest,
  LoopModuleLibraryEntry,
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
  listLoopModuleLibrary: () => request<LoopModuleLibraryEntry[]>("/api/loop-modules/library"),
  inspectLoopModule: (input: LoopModuleInspectRequest) =>
    request<LoopModuleInspection>("/api/loop-modules/inspect", { method: "POST", body: JSON.stringify(input) }),
  planLoopModuleInstall: (input: LoopModuleInstallPlanRequest) =>
    request<LoopModuleInstallPlan>("/api/loop-modules/install-plan", { method: "POST", body: JSON.stringify(input) }),
  installLoopModule: (input: LoopModuleInstallCommitRequest) =>
    request<InstalledLoopModuleStatus>("/api/loop-modules/install", { method: "POST", body: JSON.stringify(input) }),
  exportLoopModule: (input: LoopModuleExportRequest) =>
    request<LoopModuleExportResult>("/api/loop-modules/export", { method: "POST", body: JSON.stringify(input) }),
  loopModuleStatuses: () => request<InstalledLoopModuleStatus[]>("/api/loop-modules/status"),
  removeInstalledLoopModule: (loopId: string) =>
    request<void>(`/api/loop-modules/installed/${encodeURIComponent(loopId)}`, { method: "DELETE" }),
  updateLoopTheme: (theme: LoopTheme) =>
    request<LoopTheme>("/api/loop-theme", {
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
