import { useCallback, useMemo } from "react";
import type {
  ExecutionProfileSaveRequest,
  MarkdownDocument,
  CanvasTheme,
  ProjectAutomationConfig,
  GraphNodeModuleInstallCommitRequest,
  GraphNodeModuleInstallPlanRequest,
  GraphNodeModuleExportRequest,
  WorkspaceSaveRequestByCollection
} from "../../../../shared/api/workspace-contracts";
import { api } from "../../api";
import { toErrorMessage } from "@/lib/errors";
import { projectCollectionDocumentPath } from "../routing";
import { projectDocumentCreateConfig } from "../documents/projectDocuments";
import type { ProjectDocumentCreateKind, SaveCollection } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

type Notify = (input: { type: "info" | "error"; message: string }) => string;

export function useWorkspaceMutations({
  notify,
  refresh,
  navigate
}: {
  notify: Notify;
  refresh: () => Promise<void>;
  navigate: WorkspaceNavigation["navigate"];
}) {
  const runMutation = useCallback(async <T,>(action: () => Promise<T>, successMessage: string, fallbackError: string) => {
    try {
      const result = await action();
      await refresh();
      notify({ type: "info", message: successMessage });
      return result;
    } catch (err) {
      notify({ type: "error", message: toErrorMessage(err, fallbackError) });
      throw err;
    }
  }, [notify, refresh]);

  const save = useCallback(async <T extends SaveCollection>(collection: T, item: WorkspaceSaveRequestByCollection[T]) => {
    return runMutation(
      () => api.save(collection, item),
      "Saved.",
      `Unable to save ${collection}.`
    );
  }, [runMutation]);

  const saveProjectDocument = useCallback(async (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => {
    return runMutation(
      () => api.saveProjectDocument(document),
      "Saved.",
      "Unable to save project document."
    );
  }, [runMutation]);

  const createExecutionProfile = useCallback(async (id: string, profile: ExecutionProfileSaveRequest) => {
    return runMutation(
      () => api.createExecutionProfile(id, profile),
      "Execution profile created.",
      "Unable to create execution profile."
    );
  }, [runMutation]);

  const updateExecutionProfile = useCallback(async (id: string, profile: ExecutionProfileSaveRequest) => {
    return runMutation(
      () => api.updateExecutionProfile(id, profile),
      "Execution profile saved.",
      "Unable to save execution profile."
    );
  }, [runMutation]);

  const removeExecutionProfile = useCallback(async (id: string) => {
    await runMutation(
      () => api.removeExecutionProfile(id),
      "Execution profile deleted.",
      "Unable to delete execution profile."
    );
  }, [runMutation]);

  const createProjectDocument = useCallback(async (kind: ProjectDocumentCreateKind, title: string) => {
    const config = projectDocumentCreateConfig[kind];
    const saved = await runMutation(
      () => api.createProjectDocument({
        directoryPath: config.directoryPath,
        title
      }),
      "Created.",
      `Unable to create ${kind}.`
    );
    navigate(projectCollectionDocumentPath(kind, saved.relativePath), { bypassBlocker: true });
    return saved;
  }, [navigate, runMutation]);

  const remove = useCallback(async (collection: SaveCollection, id: string) => {
    await runMutation(
      () => api.remove(collection, id),
      "Deleted.",
      `Unable to delete ${collection}.`
    );
  }, [runMutation]);

  const saveAutomation = useCallback(async (config: ProjectAutomationConfig) => {
    return runMutation(
      () => api.saveAutomation(config),
      "Saved.",
      "Unable to save automation config."
    );
  }, [runMutation]);

  const updateCanvasTheme = useCallback(async (theme: CanvasTheme) => {
    return runMutation(
      () => api.updateCanvasTheme(theme),
      "Theme saved.",
      "Unable to save canvas theme."
    );
  }, [runMutation]);

  const installGraphNodeModule = useCallback(async (input: GraphNodeModuleInstallCommitRequest) => runMutation(
    () => api.installGraphNodeModule(input),
    "Graph Node module installed.",
    "Unable to install Graph Node module."
  ), [runMutation]);

  const removeInstalledGraphNodeModule = useCallback(async (graphNodeId: string) => {
    await runMutation(
      () => api.removeInstalledGraphNodeModule(graphNodeId),
      "Installed Graph Node removed.",
      "Unable to remove installed Graph Node."
    );
  }, [runMutation]);

  const exportGraphNodeModule = useCallback(async (input: GraphNodeModuleExportRequest) => runMutation(
    () => api.exportGraphNodeModule(input),
    "Graph Node module exported.",
    "Unable to export Graph Node module."
  ), [runMutation]);

  const graphNodeModules = useMemo(() => ({
    listLibrary: api.listGraphNodeModuleLibrary,
    inspect: api.inspectGraphNodeModule,
    plan: (input: GraphNodeModuleInstallPlanRequest) => api.planGraphNodeModuleInstall(input),
    install: installGraphNodeModule,
    statuses: api.graphNodeModuleStatuses,
    exportGraphNode: exportGraphNodeModule,
    remove: removeInstalledGraphNodeModule
  }), [exportGraphNodeModule, installGraphNodeModule, removeInstalledGraphNodeModule]);

  return {
    save,
    createExecutionProfile,
    updateExecutionProfile,
    removeExecutionProfile,
    saveProjectDocument,
    createProjectDocument,
    remove,
    saveAutomation,
    updateCanvasTheme,
    graphNodeModules,
    refresh
  };
}
