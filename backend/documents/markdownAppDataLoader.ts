import path from "node:path";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import { loadBalletProject, loadBalletProjectTree } from "../markdown.js";
import { projectFromDocument } from "./documentMappers.js";
import { loadProjectResources } from "./projectResourceCatalog.js";

export type WorkspaceContentData = Omit<AppData,
  "runtime" | "runtimeConfigurationIssues" | "runTargets" | "loopRuns" | "scheduleStates">;

export const loadMarkdownAppData = async (root: string): Promise<WorkspaceContentData> => {
  const [projectDocs, projectDocumentTree, resources] = await Promise.all([
    loadBalletProject(root),
    loadBalletProjectTree(root),
    loadProjectResources(root)
  ]);

  const project = projectDocs[0] ? projectFromDocument(projectDocs[0]) : {
    id: path.basename(root), name: path.basename(root), description: "Local Git checkout",
    status: "active" as const, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  return {
    project,
    executionProfiles: [],
    instructions: resources.instructions,
    skills: resources.skills,
    resourceIssues: resources.issues,
    automation: defaultProjectAutomationConfig(),
    automationIssues: [],
    loopTheme: structuredClone(defaultLoopTheme),
    loopThemeIssues: [],
    projectDocumentTree
  };
};
