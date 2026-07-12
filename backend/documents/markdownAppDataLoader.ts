import path from "node:path";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import { builtInLoopThemes } from "../../shared/domain/loopThemes.js";
import { loadAgents, loadBalletProject, loadBalletProjectTree, loadSkills } from "../markdown.js";
import { agentFromDocument, projectFromDocument, skillDocumentFromDocument } from "./documentMappers.js";
import { buildSkillLookup } from "./skillLookup.js";

export type WorkspaceContentData = Omit<AppData,
  "runtime" | "agentRuntimeConfigurations" | "executionStates" | "runTargets" | "loopRuns" | "scheduleStates">;

export const loadMarkdownAppData = async (root: string): Promise<WorkspaceContentData> => {
  const [projectDocs, projectDocumentTree, agentDocs, skillDocs] = await Promise.all([
    loadBalletProject(root),
    loadBalletProjectTree(root),
    loadAgents(root),
    loadSkills(root)
  ]);

  const project = projectDocs[0] ? projectFromDocument(projectDocs[0]) : {
    id: path.basename(root), name: path.basename(root), description: "Local Git checkout",
    status: "active" as const, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const skills = skillDocs.map(skillDocumentFromDocument);
  const skillLookup = buildSkillLookup(skills);
  const agents = agentDocs.map((doc) => agentFromDocument(doc, skillLookup));

  return {
    project,
    agents,
    skills,
    automation: defaultProjectAutomationConfig(),
    automationIssues: [],
    loopThemes: builtInLoopThemes.map((theme) => structuredClone(theme)),
    loopThemeIssues: [],
    projectDocumentTree
  };
};
