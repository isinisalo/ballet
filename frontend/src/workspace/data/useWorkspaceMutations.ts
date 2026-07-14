import { useCallback } from "react";
import type {
  MarkdownDocument,
  LoopTheme,
  ProjectAutomationConfig,
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

  const updateLoopTheme = useCallback(async (theme: LoopTheme) => {
    return runMutation(
      () => api.updateLoopTheme(theme),
      "Theme saved.",
      "Unable to save Loop theme."
    );
  }, [runMutation]);

  return {
    save,
    saveProjectDocument,
    createProjectDocument,
    remove,
    saveAutomation,
    updateLoopTheme,
    refresh
  };
}
