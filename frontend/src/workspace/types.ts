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

export type SaveCollection = "agents" | "skills";
export type AutomationLoopView = "all";
export type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

export interface RouteState {
  view: View;
  documentPath?: string;
  automationEntityId?: string;
  automationLoopView?: AutomationLoopView;
  loopThemeId?: string;
  loopThemeSourceId?: string;
  loopThemeLoopId?: string;
  runTargetKind?: "loop" | "agent";
  runTargetId?: string;
  rootRunId?: string;
}

export const emptyData: AppData = {
  project: {
    id: "",
    name: "",
    description: "",
    status: "active",
    createdAt: "",
    updatedAt: ""
  },
  agents: [],
  skills: [],
  loopRuns: [],
  scheduleStates: [],
  automation: defaultProjectAutomationConfig(),
  automationIssues: [],
  loopThemes: [...builtInLoopThemes],
  loopThemeIssues: [],
  runtime: {
    instanceId: "",
    hostname: "",
    platform: "darwin",
    architecture: "arm64",
    checkout: { path: "", headSha: "", configHash: "", dirty: false },
    uptimeSeconds: 0,
    startedAt: "",
    providers: [],
    activeRunCount: 0,
    logsPath: ""
  },
  agentRuntimeConfigurations: {},
  executionStates: [],
  runTargets: { loops: [], agents: [] },
  projectDocumentTree: []
};
