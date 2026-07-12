import type { Agent, AgentAvatar, AgentExecutionState } from "../domain/agents.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectExecutableStep,
  ProjectLoop,
  LoopNodeSize,
  ProjectOnceStepSchedule,
  ProjectRecurringStepSchedule,
  ProjectScheduledStep,
  ProjectScheduledStepTransitions,
  ProjectScheduleCadence,
  ProjectScheduleWeekday,
  ProjectStep,
  ProjectStepSchedule,
  ProjectStepTransitionEntry,
  ProjectStepTransitionId,
  ProjectStepTransitionMappers,
  ProjectStepTransitions,
  StepTransitionTarget,
  Policy
} from "../domain/automation.js";
import type {
  LoopConnectionPointStyle,
  LoopEdgeLineStyle,
  LoopNodeRenderer,
  LoopTheme,
  LoopThemeId,
  LoopThemeIssue
} from "../domain/loopThemes.js";
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
  LoopScheduleState,
  LoopRuntimePreflight,
  PairingSession,
  PortableAgentRuntimeIntent,
  ProjectCheckout,
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
export type { ProjectConfiguration } from "../domain/projectConfig.js";
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
  scheduleStates: LoopScheduleState[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  loopThemes: LoopTheme[];
  loopThemeIssues: LoopThemeIssue[];
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

export type AgentSaveRequest = Omit<Partial<Agent>, "avatar"> & {
  avatar?: AgentAvatar | null;
};

export type WorkspaceAutomationResponseDto = {
  config: ProjectAutomationConfig;
  issues: ProjectAutomationIssue[];
};

export interface CreateLoopThemeRequest {
  theme: LoopTheme;
  assignToLoopId: string;
}

export interface CreateLoopThemeResponse {
  theme: LoopTheme;
  automation: ProjectAutomationConfig;
}

export type WorkspaceSaveRequestByCollection = {
  [K in WorkspaceCollectionName]: K extends "agents"
    ? AgentSaveRequest
    : Partial<WorkspaceDataDto[K][number]>;
};

export type WorkspaceSaveResponseByCollection = {
  [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number];
};

export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export {
  defaultProjectAutomationConfig,
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isProjectExecutableStep,
  mapProjectStepTransitions,
  resolveEffectiveStartStep
} from "../domain/automation.js";
export {
  builtInLoopThemes,
  defaultLoopTheme,
  resolveLoopTheme,
  validateAutomationThemeReferences
} from "../domain/loopThemes.js";

export type {
  Agent,
  AgentAvatar,
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
  ProjectExecutableStep,
  ProjectLoop,
  LoopNodeSize,
  LoopThemeId,
  LoopTheme,
  LoopThemeIssue,
  LoopNodeRenderer,
  LoopEdgeLineStyle,
  LoopConnectionPointStyle,
  ProjectOnceStepSchedule,
  ProjectRecurringStepSchedule,
  ProjectScheduledStep,
  ProjectScheduledStepTransitions,
  ProjectScheduleCadence,
  ProjectScheduleWeekday,
  ProjectStep,
  ProjectStepSchedule,
  ProjectStepTransitionEntry,
  ProjectStepTransitionId,
  ProjectStepTransitionMappers,
  ProjectStepTransitions,
  StepTransitionTarget,
  LoopRun,
  LoopRunDetails,
  LoopExecutionPlan,
  LoopScheduleState,
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
