import type { CollectionName, MarkdownDocument, ProjectAutomationConfig } from "../../shared/domain.js";
import { store } from "../store.js";

export const workspaceService = {
  readData: () => store.read(),
  resetData: () => store.reset(),
  readAutomation: async () => {
    const data = await store.read();
    return { config: data.automation, issues: data.automationIssues };
  },
  saveAutomation: (config: ProjectAutomationConfig) => store.saveAutomation(config),
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) =>
    store.saveProjectDocument(document),
  createProjectDocument: (document: { directoryPath: string; title: string }) =>
    store.createProjectDocument(document),
  listCollection: (collection: CollectionName) => store.list(collection),
  saveCollectionItem: <T extends CollectionName>(collection: T, item: Record<string, unknown> & { id?: string }) =>
    store.upsert(collection, item as Parameters<typeof store.upsert<T>>[1]),
  removeCollectionItem: (collection: CollectionName, id: string) => store.remove(collection, id),
  listEvents: () => store.list("events"),
  createEvent: (event: Parameters<typeof store.createEvent>[0]) => store.createEvent(event),
  removeEvent: (id: string) => store.remove("events", id),
  runtimeHealth: () => store.runtimeHealth(),
  listAgentRuns: () => store.listAgentRuns(),
  listRunLogs: (runId: string) => store.listRunLogs(runId),
  retryAgentRun: (runId: string) => store.retryAgentRun(runId)
};
