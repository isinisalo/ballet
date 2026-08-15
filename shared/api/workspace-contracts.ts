// This is the single frontend/backend contract barrel. Keeping the related
// domain exports here avoids duplicate DTO shapes in the application layers.
import type {
  JsonValue,
  LoopTerminal,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectAgentValidationNode,
  ProjectAgentWorkNode,
  ProjectExecutionComposition,
  ProjectHumanValidationNode,
  ProjectHumanWorkNode,
  ProjectLoop,
  ProjectLoopEdge,
  ProjectLoopEdgeKind,
  ProjectLoopOrchestrator,
  ProjectLoopState,
  ProjectNodeAppearance,
  ProjectNodeEdge,
  ProjectNodeEdgeTarget,
  ProjectProviderWorkNode,
  ProjectScheduledWorkNode,
  ProjectValidationNode,
  ProjectWorkLoopNode,
  ProjectWorkNode,
  ReachableProjectLoopGraph,
  LoopNodeSize,
  LoopNodeSizeDefinition,
  LoopNodeStyle,
  LoopNodeStyleDefinition,
  LoopNodeStyleGroup,
  ProjectOnceWorkSchedule,
  ProjectRecurringWorkSchedule,
  ProjectScheduleCadence,
  ProjectScheduleWeekday,
  ProjectWorkSchedule
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
  CanonicalNodeOutcome,
  ControlFlowEvent,
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
  LoopStateRevision,
  LoopRuntimePreflight,
  LoopScheduleState,
  NodeRun,
  NodeRunRole,
  OrchestrationFrame,
  OrchestratorRoute,
  OrchestratorNodeOutcome,
  RepairRequest,
  RunCheck,
  RootRun,
  RootExecutionSnapshot,
  RuntimeConfigurationIssue,
  RuntimePreflightIssue,
  RuntimeProvider,
  StatePatch,
  ValidationNodeOutcome,
  WorkNodeOutcome,
  WorkLoopNodeRun
} from "../domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV2,
  TaskEnvelopeHistoryEntry,
  TaskEnvelopeLoopIdentity,
  TaskEnvelopeProviderRunIdentity,
  TaskEnvelopeRepairRequest,
  TaskEnvelopeResumeContext,
  TaskEnvelopeRunIdentity,
  TaskEnvelopeState,
  TaskEnvelopeTargetLoop,
  TaskEnvelopeV2,
  TaskEnvelopeWorkLoopNodeIdentity,
  ValidationTaskEnvelopeV2,
  WorkTaskEnvelopeV2
} from "../domain/taskEnvelope.js";
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
  defaultProjectAutomationConfig,
  defaultProjectLoopOrchestrator,
  getProjectLoopEdges,
  getProjectNodeEdges,
  getProjectNodeTargetId,
  getReachableProjectLoopGraph,
  getReachableProjectLoopIds,
  getReachableProjectNodeIds,
  hasReachableProjectLoopTerminal,
  isCalendarDate,
  isIanaTimeZone,
  isProjectAgentValidationNode,
  isProjectHumanValidationNode,
  isProjectHumanWorkNode,
  isAllowedProjectRepairRoute,
  isProjectNodeTerminalTarget,
  isProjectProviderWorkNode,
  isProjectScheduledWorkNode,
  loopNodeSizes,
  loopNodeSizeCatalog,
  loopNodeStyleCatalog,
  loopNodeStyles,
  loopTerminals,
  maxLocalAttemptsLimit,
  maxProjectStateBytes,
  maxRepairAttemptsLimit,
  maxRepairDepthLimit,
  projectConfigurationVersion,
  resolveProjectLoopStartNode
} from "../domain/automation.js";
export { defaultLoopTheme } from "../domain/loopThemes.js";
export {
  maxControlFlowTransitions, maxRuntimeJsonDepth, maxStatePatchBytes, maxStatePatchOperations
} from "../domain/runtime.js";
export {
  maxRelevantHistoryBytes, maxRelevantHistoryEntries, maxRepairRequestEnvelopeBytes,
  maxResumeContextBytes, maxTaskEnvelopeBytes, taskEnvelopeVersion
} from "../domain/taskEnvelope.js";
export { automationConfigSchema, kebabCaseIdPattern } from "./workspace-schemas.js";

export type {
  MarkdownDocument, Project, ProjectInstruction, ProjectResourceIssue, ExecutionProfile,
  JsonValue, LoopTerminal, ProjectAutomationConfig, ProjectAutomationIssue, ProjectDocumentTreeNode,
  ProjectAgentValidationNode, ProjectAgentWorkNode, ProjectExecutionComposition, ProjectHumanValidationNode, ProjectHumanWorkNode,
  ProjectLoop, ProjectLoopEdge, ProjectLoopEdgeKind, ProjectLoopOrchestrator, ProjectLoopState,
  ProjectNodeAppearance, ProjectNodeEdge, ProjectNodeEdgeTarget, ProjectProviderWorkNode, ProjectScheduledWorkNode,
  ProjectValidationNode, ProjectWorkLoopNode, ProjectWorkNode, ReachableProjectLoopGraph,
  LoopNodeSize, LoopNodeSizeDefinition, LoopNodeStyle, LoopNodeStyleDefinition, LoopNodeStyleGroup,
  LoopTheme, LoopThemeIssue,
  LoopEdgeLineStyle, LoopConnectionPointStyle, ProjectOnceWorkSchedule, ProjectRecurringWorkSchedule,
  ProjectScheduleCadence, ProjectScheduleWeekday, ProjectWorkSchedule, LoopRun, LoopRunDetails,
  LoopScheduleState, LoopRuntimePreflight,
  CanonicalNodeOutcome, ControlFlowEvent, LoopStateRevision, NodeRun, NodeRunRole,
  OrchestrationFrame, OrchestratorNodeOutcome, OrchestratorRoute, RepairRequest, RootRun, RunCheck,
  StatePatch, ValidationNodeOutcome, WorkLoopNodeRun, WorkNodeOutcome,
  OrchestratorTaskEnvelopeV2, TaskEnvelopeHistoryEntry, TaskEnvelopeLoopIdentity,
  TaskEnvelopeProviderRunIdentity, TaskEnvelopeRepairRequest, TaskEnvelopeResumeContext,
  TaskEnvelopeRunIdentity, TaskEnvelopeState, TaskEnvelopeTargetLoop, TaskEnvelopeV2,
  TaskEnvelopeWorkLoopNodeIdentity,
  ValidationTaskEnvelopeV2, WorkTaskEnvelopeV2,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot,
  ExecutionResourceEvidence, RootExecutionSnapshot, ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask,
  LocalProviderStatus, LocalRuntime, RuntimeProvider, RuntimePreflightIssue, RuntimeConfigurationIssue,
  BalletMode, DashboardRunStatus, RootRunDetail, RootRunKind, RootRunListResponse, RootRunListState,
  RootRunSource, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, StartRootRunRequest,
  WorkspaceInvalidationEvent, Skill
};
