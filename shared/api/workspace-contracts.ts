import type { Agent, AgentExecutionState, AgentNodeStyle } from "../domain/agents.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget,
  Policy
} from "../domain/automation.js";
import type {
  Adr,
  Goal,
  MarkdownDocument,
  Project,
  ProjectDocumentTreeNode,
  Skill
} from "../domain/documents.js";
import type { EventDefinition, EventRecord } from "../domain/events.js";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeConfiguration,
  AgentOutcome,
  AgentRun,
  ExecutionAgentSnapshot,
  ExecutionEvent,
  ExecutionEventPage,
  ExecutionSpec,
  ExecutionTask,
  LoopRun,
  LoopRunDetails,
  LoopExecutionPlan,
  LoopRuntimePreflight,
  PairingSession,
  PortableAgentRuntimeIntent,
  ProjectCheckout,
  ProjectRuntimeConfig,
  ResolvedAgentExecution,
  RespondToStepRunRequest,
  RuntimeBackend,
  RuntimeDevice,
  RuntimeProvider,
  ExecutionPolicy,
  RuntimePreflightIssue,
  RuntimeConfigurationIssue,
  StartLoopRunRequest,
  StartAgentRunRequest,
  StepRun,
} from "../domain/runtime.js";
import type {
  BalletMode,
  DashboardRunStatus,
  RootRunDetail,
  RootRunKind,
  RootRunListResponse,
  RootRunListState,
  RootRunSource,
  RootRunSummary,
  RunInvalidationEvent,
  RunTarget,
  RunTargetIssue,
  RunTargetsResponse
} from "../domain/runs.js";

export type EventIntakeRequest = Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">;
export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;

export interface WorkspaceDataDto {
  projects: Project[];
  goals: Goal[];
  adrs: Adr[];
  agents: Agent[];
  skills: Skill[];
  policies: Policy[];
  eventDefinitions: EventDefinition[];
  events: EventRecord[];
  loopRuns: LoopRunDetails[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  projectDocumentTree?: ProjectDocumentTreeNode[];
  documents?: {
    project: MarkdownDocument[];
    goals: MarkdownDocument[];
    adr: MarkdownDocument[];
    agents: MarkdownDocument[];
    skills: MarkdownDocument[];
    events: MarkdownDocument[];
    policies: MarkdownDocument[];
  };
  projectRoot?: string;
}

export type WorkspaceCollectionName = "projects" | "goals" | "adrs" | "agents" | "skills" | "policies" | "events";

export type WorkspaceAutomationResponseDto = {
  config: ProjectAutomationConfig;
  issues: ProjectAutomationIssue[];
};

export type WorkspaceSaveRequestByCollection = {
  [K in WorkspaceCollectionName]: Partial<WorkspaceDataDto[K][number]>;
};

export type WorkspaceSaveResponseByCollection = {
  [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number];
};

export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export { defaultProjectAutomationConfig } from "../domain/automation.js";

export type {
  Agent,
  AgentNodeStyle,
  AgentExecutionState,
  Adr,
  EventDefinition,
  EventRecord,
  Goal,
  MarkdownDocument,
  Policy,
  Project,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectDocumentTreeNode,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget,
  LoopRun,
  LoopRunDetails,
  LoopExecutionPlan,
  LoopRuntimePreflight,
  StartLoopRunRequest,
  StartAgentRunRequest,
  RespondToStepRunRequest,
  StepRun,
  AgentRuntimeAttachment,
  AgentRuntimeConfiguration,
  AgentOutcome,
  ExecutionAgentSnapshot,
  ExecutionPolicy,
  PortableAgentRuntimeIntent,
  ProjectRuntimeConfig,
  ResolvedAgentExecution,
  AgentRun,
  ExecutionEvent,
  ExecutionEventPage,
  ExecutionSpec,
  ExecutionTask,
  PairingSession,
  ProjectCheckout,
  RuntimeBackend,
  RuntimeDevice,
  RuntimeProvider,
  RuntimePreflightIssue,
  RuntimeConfigurationIssue,
  BalletMode,
  DashboardRunStatus,
  RootRunDetail,
  RootRunKind,
  RootRunListResponse,
  RootRunListState,
  RootRunSource,
  RootRunSummary,
  RunInvalidationEvent,
  RunTarget,
  RunTargetIssue,
  RunTargetsResponse,
  Skill
};
