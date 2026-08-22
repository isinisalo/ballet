import { defaultCanvasTheme, defaultProjectAutomationConfig, type AppData } from "@shared/api/workspace-contracts";

export type View =
  | "projects"
  | "project-document"
  | "project-goals"
  | "project-adrs"
  | "project-instructions"
  | "automation"
  | "canvas-theme"
  | "runtimes"
  | "execution-profiles"
  | "skills"
  | "run";

export type SaveCollection = "skills";
export type EngineeringLevel = "graph" | "graph_node" | "job_node";
export type ProjectDocumentCreateKind = "adr" | "goal" | "instruction";

export interface RouteState {
  view: View;
  creating?: boolean;
  documentPath?: string;
  executionProfileId?: string;
  engineeringLevel?: EngineeringLevel;
  graphNodeId?: string;
  jobNodeId?: string;
  runTargetKind?: "graph" | "graph_node";
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
  graphNodeInvocations: [],
  activeRootRuns: [],
  routingDecisions: [],
  automation: defaultProjectAutomationConfig(),
  automationIssues: [],
  canvasTheme: structuredClone(defaultCanvasTheme),
  canvasThemeIssues: [],
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
  runTargets: {
    graph: { kind: "graph", id: "", name: "Graph", ready: false, issues: [] },
    graphNodes: []
  },
  projectDocumentTree: []
};
