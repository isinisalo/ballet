import { defaultLoopTheme, defaultProjectAutomationConfig, type AppData } from "@shared/api/workspace-contracts";

export type View =
  | "projects"
  | "project-document"
  | "project-goals"
  | "project-adrs"
  | "project-instructions"
  | "automation"
  | "loop-theme"
  | "runtimes"
  | "execution-profiles"
  | "skills"
  | "run";

export type SaveCollection = "skills";
export type EngineeringView = "graph" | "loop";
export type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

export interface RouteState {
  view: View;
  creating?: boolean;
  documentPath?: string;
  executionProfileId?: string;
  automationEntityId?: string;
  automationView?: EngineeringView;
  automationRouteIssue?: "invalid-view" | "missing-loop-id" | "non-canonical-graph";
  runTargetKind?: "loop";
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
  executionProfiles: [],
  instructions: [],
  skills: [],
  resourceIssues: [],
  loopRuns: [],
  scheduleStates: [],
  automation: defaultProjectAutomationConfig(),
  automationIssues: [],
  loopTheme: structuredClone(defaultLoopTheme),
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
  runtimeConfigurationIssues: [],
  runTargets: { loops: [] },
  projectDocumentTree: []
};
