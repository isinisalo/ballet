import { useMemo } from "react";
import type {
  Agent,
  AppData,
  MarkdownDocument,
  Project,
  ProjectDocumentTreeNode,
  Skill
} from "@shared/api/workspace-contracts";
import {
  findProjectTreeDirectory,
  findProjectTreeDocument,
  selectedProjectTreeDocument,
  type ProjectTreeDirectory
} from "../documents/projectDocuments";
import type { RouteState } from "../types";

export type WorkspaceSelectionInput = {
  data: AppData;
  route: RouteState;
};

export type WorkspaceSelection = {
  project?: Project;
  projectDocumentTree: ProjectDocumentTreeNode[];
  selectedProjectDocument?: MarkdownDocument;
  adrDirectory?: ProjectTreeDirectory;
  goalsDirectory?: ProjectTreeDirectory;
  instructionsDirectory?: ProjectTreeDirectory;
  selectedAdr?: MarkdownDocument;
  selectedGoal?: MarkdownDocument;
  selectedInstruction?: MarkdownDocument;
  selectedAgent?: Agent;
  selectedSkill?: Skill;
};

export function getWorkspaceSelection({
  data,
  route
}: WorkspaceSelectionInput): WorkspaceSelection {
  const project = data.project;
  const projectDocumentTree = data.projectDocumentTree ?? [];
  const selectedProjectDocument = findProjectTreeDocument(projectDocumentTree, route.documentPath);
  const adrDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/adr");
  const goalsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/goals");
  const instructionsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/instructions");
  const selectedAdr = route.documentPath ? selectedProjectTreeDocument(adrDirectory, route.documentPath) : undefined;
  const selectedGoal = route.documentPath ? selectedProjectTreeDocument(goalsDirectory, route.documentPath) : undefined;
  const selectedInstruction = route.documentPath ? selectedProjectTreeDocument(instructionsDirectory, route.documentPath) : undefined;
  const selectedAgent =
    route.view === "agents" && !route.documentPath
      ? undefined
      : data.agents.find((agent) => agent.relativePath === route.documentPath) ?? data.agents[0];
  const selectedSkill = route.documentPath ? data.skills.find((skill) => skill.relativePath === route.documentPath) : undefined;

  return {
    project,
    projectDocumentTree,
    selectedProjectDocument,
    adrDirectory,
    goalsDirectory,
    instructionsDirectory,
    selectedAdr,
    selectedGoal,
    selectedInstruction,
    selectedAgent,
    selectedSkill
  };
}

export function useWorkspaceSelection(input: WorkspaceSelectionInput): WorkspaceSelection {
  return useMemo(
    () => getWorkspaceSelection(input),
    [input.data, input.route]
  );
}
