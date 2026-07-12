import type {
  AppData,
  CollectionName,
  WorkspaceSaveRequestByCollection,
  ExecutionEventPage
} from "@shared/api/workspace-contracts";
import type { CreateLoopThemeResponse, LoopTheme, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import type { MarkdownDocument } from "@shared/api/workspace-contracts";
import { request } from "@/apiClient";

export const api = {
  getData: () => request<AppData>("/api/data"),
  saveAutomation: (config: ProjectAutomationConfig) =>
    request<ProjectAutomationConfig>("/api/automation", {
      method: "PUT",
      body: JSON.stringify(config)
    }),
  updateLoopTheme: (theme: LoopTheme) =>
    request<LoopTheme>(`/api/loop-themes/${encodeURIComponent(theme.id)}`, {
      method: "PUT",
      body: JSON.stringify(theme)
    }),
  createLoopTheme: (theme: LoopTheme, assignToLoopId: string) =>
    request<CreateLoopThemeResponse>("/api/loop-themes", {
      method: "POST",
      body: JSON.stringify({ theme, assignToLoopId })
    }),
  getExecutionEvents: (taskId: string, after = 0, limit = 500) =>
    request<ExecutionEventPage>(`/api/execution-tasks/${encodeURIComponent(taskId)}/events?after=${after}&limit=${limit}`),
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
    request<void>(`/api/${collection}/${id}`, { method: "DELETE" })
};
