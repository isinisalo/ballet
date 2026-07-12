import { builtInLoopThemes, defaultProjectAutomationConfig, type AppData } from "@shared/api/workspace-contracts";

export type View =
  | "projects"
  | "project-document"
  | "project-goals"
  | "project-adrs"
  | "project-instructions"
  | "automation"
  | "loop-theme"
  | "runtimes"
  | "agents"
  | "skills"
  | "run";

export type SaveCollection = "projects" | "goals" | "adrs" | "agents" | "skills";
export type AutomationLoopView = "all";
export type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

export interface RouteState {
  view: View;
  projectId?: string;
  documentPath?: string;
  automationEntityId?: string;
  automationLoopView?: AutomationLoopView;
  loopThemeId?: string;
  loopThemeSourceId?: string;
  loopThemeLoopId?: string;
  runtimeDeviceId?: string;
  runTargetKind?: "loop" | "agent";
  runTargetId?: string;
  rootRunId?: string;
}

export const emptyData: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  skills: [],
  policies: [],
  eventDefinitions: [],
  events: [],
  loopRuns: [],
  scheduleStates: [],
  automation: defaultProjectAutomationConfig(),
  automationIssues: [],
  loopThemes: [...builtInLoopThemes],
  loopThemeIssues: [],
  projectDocumentTree: []
};
