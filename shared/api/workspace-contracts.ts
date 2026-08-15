// This is the single frontend/backend contract barrel. Keeping the related
// domain exports here avoids duplicate DTO shapes in the application layers.
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectAgentStep,
  ProjectExecutionStep,
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
import type {
  MarkdownDocument,
  Project,
  ProjectDocumentTreeNode,
  ProjectInstruction,
  ProjectResourceIssue,
  Skill
} from "../domain/documents.js";
import type { ExecutionProfile } from "../domain/projectConfig.js";
import type {
  ExecutionEvent,
  ExecutionEventPage,
  ExecutionPolicy,
  ExecutionProjectSnapshot,
  ExecutionResourceEvidence,
  ExecutionRuntimeSnapshot,
  ExecutionSpec,
  ExecutionTask,
  LocalProviderStatus,
  LocalRuntime,
  LoopRun,
  LoopRunDetails,
  LoopRuntimePreflight,
  LoopScheduleState,
  RespondToStepRunRequest,
  RootExecutionSnapshot,
  RuntimeConfigurationIssue,
  RuntimePreflightIssue,
  RuntimeProvider,
  StepOutcome,
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
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  resourceIssues: ProjectResourceIssue[];
  loopRuns: LoopRunDetails[];
  scheduleStates: LoopScheduleState[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  loopTheme: LoopTheme;
  loopThemeIssues: LoopThemeIssue[];
  runtime: LocalRuntime;
  runtimeConfigurationIssues: RuntimeConfigurationIssue[];
  runTargets: RunTargetsResponse;
  projectDocumentTree?: ProjectDocumentTreeNode[];
}

export type WorkspaceCollectionName = "skills";
type ServerManagedEntityField =
  | "relativePath"
  | "slug"
  | "errors"
  | "projectId"
  | "origin"
  | "valid"
  | "sourceSha256"
  | "contentSha256"
  | "sizeBytes";
export type SkillSaveRequest = Omit<Partial<Skill>, ServerManagedEntityField>;
export type ExecutionProfileSaveRequest = Omit<ExecutionProfile, "id">;
export type WorkspaceAutomationResponseDto = { config: ProjectAutomationConfig; issues: ProjectAutomationIssue[] };

export type WorkspaceSaveRequestByCollection = {
  skills: SkillSaveRequest;
};
export type WorkspaceSaveResponseByCollection = {
  [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number];
};

export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export {
  clockTimePattern,
  defaultLoopNodeSize,
  defaultLoopNodeStyle,
  defaultTerminalNodes,
  defaultTransitionFor,
  defaultProjectAutomationConfig,
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isCalendarDate,
  isIanaTimeZone,
  isProjectExecutionStep,
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
  MarkdownDocument, Project, ProjectInstruction, ProjectResourceIssue, ExecutionProfile,
  ProjectAutomationConfig, ProjectAutomationIssue, ProjectAgentStep, ProjectExecutionStep, ProjectDocumentTreeNode, ProjectExecutableStep,
  ProjectLoop, ProjectLoopNode, ProjectTerminalNode, LoopNodeSize, LoopNodeSizeDefinition, LoopNodeStyle, LoopNodeStyleDefinition, LoopNodeStyleGroup,
  LoopTheme, LoopThemeIssue,
  LoopEdgeLineStyle, LoopConnectionPointStyle, ProjectOnceStepSchedule, ProjectRecurringStepSchedule,
  ProjectScheduledStep, ProjectScheduleCadence, ProjectScheduleWeekday,
  ProjectStep, ProjectStepSchedule, ProjectStepTransitionEntry, ProjectStepTransitionId,
  ProjectStepTransitionMappers, ProjectStepTransitions, StepEndStatus, StepTransitionTarget, LoopRun, LoopRunDetails,
  LoopScheduleState, LoopRuntimePreflight,
  RespondToStepRunRequest, StepRun, StepOutcome,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot,
  ExecutionResourceEvidence, RootExecutionSnapshot, ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask,
  LocalProviderStatus, LocalRuntime, RuntimeProvider, RuntimePreflightIssue, RuntimeConfigurationIssue,
  BalletMode, DashboardRunStatus, RootRunDetail, RootRunKind, RootRunListResponse, RootRunListState,
  RootRunSource, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, StartRootRunRequest,
  WorkspaceInvalidationEvent, Skill
};
