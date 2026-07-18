// This is the single frontend/backend contract barrel. Keeping the related
// domain exports here avoids duplicate DTO shapes in the application layers.
import type { Agent, AgentAvatar, AgentExecutionState } from "../domain/agents.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectAgentBackedStep,
  ProjectExecutableStep,
  ProjectLoop,
  ProjectLoopNode,
  ProjectTerminalNode,
  LoopNodeSize,
  LoopNodeSizeDefinition,
  LoopNodeStyle,
  LoopNodeStyleDefinition,
  LoopNodeStyleGroup,
  ProjectOnceStepSchedule,
  ProjectRecurringStepSchedule,
  ProjectScheduledStep,
  ProjectScheduleCadence,
  ProjectScheduleWeekday,
  ProjectStep,
  ProjectStepSchedule,
  ProjectStepTransitionEntry,
  ProjectStepTransitionId,
  ProjectAgentStepTransitions,
  ProjectHumanStepTransitions,
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
  AgentOutcomeStatus,
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
  LoopRunTermination,
  LoopRuntimePreflight,
  LoopScheduleState,
  HumanDecision,
  PortableAgentRuntimeIntent,
  ResolvedAgentExecution,
  RespondToStepRunRequest,
  RuntimeConfigurationIssue,
  RuntimePreflightIssue,
  RuntimeProvider,
  StepRun,
  StepRunResult,
  StepRunTransition
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
  defaultAgentStepTransitions,
  defaultHumanStepTransitions,
  defaultLoopNodeSize,
  defaultLoopNodeStyle,
  defaultTerminalNodes,
  defaultTransitionFor,
  defaultProjectAutomationConfig,
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isCalendarDate,
  isIanaTimeZone,
  isProjectAgentBackedStep,
  isProjectTerminalNode,
  loopNodeSizes,
  loopNodeSizeCatalog,
  loopNodeStyleCatalog,
  loopNodeStyles,
  mapProjectStepTransitions,
  resolveEffectiveStartStep
} from "../domain/automation.js";
export { defaultLoopTheme } from "../domain/loopThemes.js";

export type {
  Agent, AgentAvatar, AgentExecutionState, MarkdownDocument, Project,
  ProjectAutomationConfig, ProjectAutomationIssue, ProjectAgentBackedStep, ProjectDocumentTreeNode, ProjectExecutableStep,
  ProjectLoop, ProjectLoopNode, ProjectTerminalNode, LoopNodeSize, LoopNodeSizeDefinition, LoopNodeStyle, LoopNodeStyleDefinition, LoopNodeStyleGroup,
  LoopTheme, LoopThemeIssue,
  LoopEdgeLineStyle, LoopConnectionPointStyle, ProjectOnceStepSchedule, ProjectRecurringStepSchedule,
  ProjectScheduledStep, ProjectScheduleCadence, ProjectScheduleWeekday,
  ProjectStep, ProjectStepSchedule, ProjectStepTransitionEntry, ProjectStepTransitionId,
  ProjectAgentStepTransitions, ProjectHumanStepTransitions, ProjectStepTransitionMappers, ProjectStepTransitions, StepEndStatus, StepTransitionTarget, LoopRun, LoopRunDetails,
  LoopExecutionPlan, LoopScheduleState, LoopRuntimePreflight,
  RespondToStepRunRequest, StepRun, StepRunResult, StepRunTransition, LoopRunTermination, AgentRuntimeConfiguration, AgentOutcome, AgentOutcomeStatus, HumanDecision, ExecutionAgentSnapshot,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot, PortableAgentRuntimeIntent,
  ResolvedAgentExecution, ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask,
  LocalProviderStatus, LocalRuntime, RuntimeProvider, RuntimePreflightIssue, RuntimeConfigurationIssue,
  BalletMode, DashboardRunStatus, RootRunDetail, RootRunKind, RootRunListResponse, RootRunListState,
  RootRunSource, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, StartRootRunRequest,
  WorkspaceInvalidationEvent, Skill
};
