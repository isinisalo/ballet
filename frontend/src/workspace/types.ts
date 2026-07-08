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
export type AutomationTab = "actions" | "loops";
export type AutomationLoopView = "all";
export type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

export interface RouteState {
  view: View;
  projectId?: string;
  documentPath?: string;
  automationTab?: AutomationTab;
  automationEntityId?: string;
  automationLoopView?: AutomationLoopView;
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
  agentRuns: [],
  automation: defaultProjectAutomationConfig(),
  automationIssues: [],
  projectDocumentTree: []
};
