// This is the single frontend/backend contract barrel. Keeping the related
// domain exports here avoids duplicate DTO shapes in the application layers.
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
  StepTransitionTarget
} from "../domain/automation.js";
import type {
  LoopConnectionPointStyle,
  LoopEdgeLineStyle,
  LoopNodeRenderer,
  LoopTheme,
  LoopThemeId,
  LoopThemeIssue
} from "../domain/loopThemes.js";
import type { MarkdownDocument, Project, ProjectDocumentTreeNode, Skill } from "../domain/documents.js";
import type {
  AgentRuntimeConfiguration,
  AgentOutcome,
  ExecutionAgentSnapshot,
  ExecutionEvent,
  ExecutionEventPage,
  ExecutionPolicy,
  ExecutionProjectSnapshot,
  ExecutionRuntimeSnapshot,
  ExecutionSpec,
  ExecutionTask,
  LocalProviderStatus,
  LocalRuntime,
  LoopExecutionPlan,
  LoopRun,
  LoopRunDetails,
  LoopRuntimePreflight,
  LoopScheduleState,
  PortableAgentRuntimeIntent,
  ResolvedAgentExecution,
  RespondToStepRunRequest,
  RuntimeConfigurationIssue,
  RuntimePreflightIssue,
  RuntimeProvider,
  StepRun
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
  RunTarget,
  RunTargetIssue,
  RunTargetsResponse,
  StartRootRunRequest,
  WorkspaceInvalidationEvent
} from "../domain/runs.js";

export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;

export interface WorkspaceDataDto {
  project: Project;
  agents: Agent[];
  skills: Skill[];
  loopRuns: LoopRunDetails[];
  scheduleStates: LoopScheduleState[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  loopThemes: LoopTheme[];
  loopThemeIssues: LoopThemeIssue[];
  runtime: LocalRuntime;
  agentRuntimeConfigurations: Record<string, AgentRuntimeConfiguration>;
  executionStates: AgentExecutionState[];
  runTargets: RunTargetsResponse;
  projectDocumentTree?: ProjectDocumentTreeNode[];
}

export type WorkspaceCollectionName = "agents" | "skills";
export type AgentSaveRequest = Omit<Partial<Agent>, "avatar"> & { avatar?: AgentAvatar | null };
export type WorkspaceAutomationResponseDto = { config: ProjectAutomationConfig; issues: ProjectAutomationIssue[] };
export interface CreateLoopThemeRequest { theme: LoopTheme; assignToLoopId: string }
export interface CreateLoopThemeResponse { theme: LoopTheme; automation: ProjectAutomationConfig }

export type WorkspaceSaveRequestByCollection = {
  [K in WorkspaceCollectionName]: K extends "agents" ? AgentSaveRequest : Partial<WorkspaceDataDto[K][number]>;
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
export { builtInLoopThemes, defaultLoopTheme, resolveLoopTheme, validateAutomationThemeReferences } from "../domain/loopThemes.js";

export type {
  Agent, AgentAvatar, AgentExecutionState, MarkdownDocument, Project,
  ProjectAutomationConfig, ProjectAutomationIssue, ProjectDocumentTreeNode, ProjectExecutableStep,
  ProjectLoop, LoopNodeSize, LoopThemeId, LoopTheme, LoopThemeIssue, LoopNodeRenderer,
  LoopEdgeLineStyle, LoopConnectionPointStyle, ProjectOnceStepSchedule, ProjectRecurringStepSchedule,
  ProjectScheduledStep, ProjectScheduledStepTransitions, ProjectScheduleCadence, ProjectScheduleWeekday,
  ProjectStep, ProjectStepSchedule, ProjectStepTransitionEntry, ProjectStepTransitionId,
  ProjectStepTransitionMappers, ProjectStepTransitions, StepTransitionTarget, LoopRun, LoopRunDetails,
  LoopExecutionPlan, LoopScheduleState, LoopRuntimePreflight,
  RespondToStepRunRequest, StepRun, AgentRuntimeConfiguration, AgentOutcome, ExecutionAgentSnapshot,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot, PortableAgentRuntimeIntent,
  ResolvedAgentExecution, ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask,
  LocalProviderStatus, LocalRuntime, RuntimeProvider, RuntimePreflightIssue, RuntimeConfigurationIssue,
  BalletMode, DashboardRunStatus, RootRunDetail, RootRunKind, RootRunListResponse, RootRunListState,
  RootRunSource, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, StartRootRunRequest,
  WorkspaceInvalidationEvent, Skill
};
