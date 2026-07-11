import { defaultProjectAutomationConfig, type AppData } from "@shared/api/workspace-contracts";

export type View =
  | "projects"
  | "project-document"
  | "project-goals"
  | "project-adrs"
  | "project-instructions"
  | "automation"
  | "runtimes"
  | "agents"
  | "skills";

export type SaveCollection = "projects" | "goals" | "adrs" | "agents" | "skills";
export type AutomationLoopView = "all";
export type AutomationLoopMode = "edit" | "run";
export type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

export interface RouteState {
  view: View;
  projectId?: string;
  documentPath?: string;
  automationEntityId?: string;
  automationLoopView?: AutomationLoopView;
  automationLoopMode?: AutomationLoopMode;
  runtimeId?: string;
}

export const emptyData: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  skills: [],
  runtimes: [],
  policies: [],
  eventDefinitions: [],
  events: [],
  loopRuns: [],
  automation: defaultProjectAutomationConfig(),
  automationIssues: [],
  projectDocumentTree: []
};
