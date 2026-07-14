// This is the single frontend/backend contract barrel. Keeping the related
// domain exports here avoids duplicate DTO shapes in the application layers.
import type { Agent, AgentAvatar, AgentExecutionState } from "../domain/agents.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectAgentBackedStep,
  ProjectExecutableStep,
  ProjectLoop,
  LoopNodeSize,
  LoopNodeStyle,
  LoopNodeStyleDefinition,
  ProjectOnceStepSchedule,
  ProjectRecurringStepSchedule,
  ProjectScheduledStep,
  ProjectScheduleCadence,
  ProjectScheduleWeekday,
  ProjectStep,
  ProjectStepSchedule,
  ProjectStepTransitionEntry,
  ProjectStepTransitionId,
  ProjectStepTransitionMappers,
  ProjectStepTransitions,
  StepEndStatus,
  StepTransitionTarget
} from "../domain/automation.js";
import type {
  LoopConnectionPointStyle,
  LoopEdgeLineStyle,
  LoopTheme,
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
  loopTheme: LoopTheme;
  loopThemeIssues: LoopThemeIssue[];
  runtime: LocalRuntime;
  agentRuntimeConfigurations: Record<string, AgentRuntimeConfiguration>;
  executionStates: AgentExecutionState[];
  runTargets: RunTargetsResponse;
  projectDocumentTree?: ProjectDocumentTreeNode[];
}

export type WorkspaceCollectionName = "agents" | "skills";
type ServerManagedEntityField = "relativePath" | "slug" | "errors";
export type AgentSaveRequest = Omit<Partial<Agent>, ServerManagedEntityField | "createdAt" | "updatedAt" | "avatar">
  & { avatar?: AgentAvatar | null };
export type SkillSaveRequest = Omit<Partial<Skill>, ServerManagedEntityField>;
export type WorkspaceAutomationResponseDto = { config: ProjectAutomationConfig; issues: ProjectAutomationIssue[] };

export type WorkspaceSaveRequestByCollection = {
  [K in WorkspaceCollectionName]: K extends "agents" ? AgentSaveRequest : SkillSaveRequest;
};
export type WorkspaceSaveResponseByCollection = {
  [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number];
};

export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export {
  clockTimePattern,
  defaultLoopNodeStyle,
  defaultTransitionFor,
  defaultProjectAutomationConfig,
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isCalendarDate,
  isIanaTimeZone,
  isProjectAgentBackedStep,
  loopNodeSizes,
  loopNodeStyleCatalog,
  loopNodeStyles,
  mapProjectStepTransitions,
  resolveEffectiveStartStep
} from "../domain/automation.js";
export { defaultLoopTheme } from "../domain/loopThemes.js";

export type {
  Agent, AgentAvatar, AgentExecutionState, MarkdownDocument, Project,
  ProjectAutomationConfig, ProjectAutomationIssue, ProjectAgentBackedStep, ProjectDocumentTreeNode, ProjectExecutableStep,
  ProjectLoop, LoopNodeSize, LoopNodeStyle, LoopNodeStyleDefinition, LoopTheme, LoopThemeIssue,
  LoopEdgeLineStyle, LoopConnectionPointStyle, ProjectOnceStepSchedule, ProjectRecurringStepSchedule,
  ProjectScheduledStep, ProjectScheduleCadence, ProjectScheduleWeekday,
  ProjectStep, ProjectStepSchedule, ProjectStepTransitionEntry, ProjectStepTransitionId,
  ProjectStepTransitionMappers, ProjectStepTransitions, StepEndStatus, StepTransitionTarget, LoopRun, LoopRunDetails,
  LoopExecutionPlan, LoopScheduleState, LoopRuntimePreflight,
  RespondToStepRunRequest, StepRun, AgentRuntimeConfiguration, AgentOutcome, ExecutionAgentSnapshot,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot, PortableAgentRuntimeIntent,
  ResolvedAgentExecution, ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask,
  LocalProviderStatus, LocalRuntime, RuntimeProvider, RuntimePreflightIssue, RuntimeConfigurationIssue,
  BalletMode, DashboardRunStatus, RootRunDetail, RootRunKind, RootRunListResponse, RootRunListState,
  RootRunSource, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, StartRootRunRequest,
  WorkspaceInvalidationEvent, Skill
};
