// This is the single frontend/backend contract barrel. Keeping the related
// domain exports here avoids duplicate DTO shapes in the application layers.
export {
  controlFlowEventSchema,
  loopStateRevisionMetadataSchema,
  orchestrationFrameSchema,
  orchestrationRequestSchema,
  orchestratorRouteSchema,
  repairRequestSchema,
  repairResultSchema,
  respondToNodeRunBodySchema,
  rootRunListQuerySchema,
  rootRunOrchestrationProjectionSchema,
  rootRunRepairProjectionSchema,
  rootRunReturnDestinationSchema,
  rootRunStateProjectionSchema,
  validationNodeOutcomeSchema,
  jobNodeOutcomeSchema,
  workspaceInvalidationEventSchema
} from "./runtime-schemas.js";
import type {
  JsonValue,
  WorkflowResult,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectAgentValidationNode,
  ProjectAgentJobNode,
  ProjectExecutionComposition,
  ProjectGraph,
  ProjectHumanValidationNode,
  ProjectHumanJobNode,
  ProjectLoop,
  ProjectLoopCapabilities,
  ProjectGraphTransition,
  ProjectRepairEdge,
  ProjectLoopOrchestrator,
  ProjectLoopRepairRouter,
  ProjectLoopState,
  ProjectNodeAppearance,
  ProjectFailEdge,
  ProjectJobNode,
  ProjectPassEdge,
  ProjectPassEdgeTarget,
  ProjectProviderJobNode,
  ProjectScheduledJobNode,
  ProjectValidationNode,
  ProjectWorkflow,
  ReachableProjectLoopGraph,
  LoopNodeSize,
  LoopNodeSizeDefinition,
  LoopNodeStyle,
  LoopNodeStyleDefinition,
  LoopNodeStyleGroup,
  ProjectOnceJobSchedule,
  ProjectRecurringJobSchedule,
  ProjectScheduleCadence,
  ProjectScheduleWeekday,
  ProjectJobSchedule
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
import type { ExecutionProfile, ProjectIssueTrackerConfig } from "../domain/projectConfig.js";
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
  LoopRunStatus,
  LoopStateRevision,
  LoopStateRevisionMetadata,
  LoopRuntimePreflight,
  LoopScheduleState,
  NodeRun,
  NodeRunRole,
  NodeRunStatus,
  OrchestrationFrame,
  OrchestrationRequest,
  OrchestratorRoute,
  OrchestratorNodeOutcome,
  RepairRequest,
  RepairResult,
  RunCheck,
  RootRun,
  RootExecutionSnapshot,
  RuntimeConfigurationIssue,
  RuntimePreflightIssue,
  RuntimeProvider,
  StatePatch,
  ValidationNodeOutcome,
  JobNodeOutcome,
  JobRun
} from "../domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV6,
  TaskEnvelopeHistoryEntry,
  TaskEnvelopeLoopIdentity,
  TaskEnvelopeOrchestrationRequest,
  TaskEnvelopeProviderRunIdentity,
  TaskEnvelopeRepairRequest,
  TaskEnvelopeRepairReturn,
  TaskEnvelopeResumeContext,
  TaskEnvelopeRunIdentity,
  TaskEnvelopeState,
  TaskEnvelopeRouteCandidate,
  TaskEnvelopeV6,
  TaskEnvelopeWorkflowNodeIdentity,
  ValidationTaskEnvelopeV6,
  JobTaskEnvelopeV6
} from "../domain/taskEnvelope.js";
import type {
  BalletMode,
  DashboardRunStatus,
  GraphOrchestrationStateV1,
  RootRunDetail,
  RootRunRepairProjection,
  RootRunOrchestrationProjection,
  RootRunReturnDestination,
  RootRunStateProjection,
  RootRunKind,
  RootRunListResponse,
  RootRunListState,
  RootRunSource,
  RootRunSummary,
  RunTarget,
  RunTargetIssue,
  RunTargetsResponse,
  RespondToNodeRunRequest,
  StartRootRunRequest,
  WorkspaceInvalidationEvent,
  WorkspaceInvalidationInput
} from "../domain/runs.js";
import type {
  InstalledLoopModuleStatus,
  LoopModuleExportResult,
  LoopModuleInspection,
  LoopModuleInstallPlan,
  LoopModuleLibraryEntry,
  LoopModulePackageV3
} from "../domain/loopModules.js";

export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;

export interface WorkspaceDataDto {
  project: Project;
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  resourceIssues: ProjectResourceIssue[];
  loopRuns: LoopRunDetails[];
  activeRootRuns: RootRun[];
  orchestratorRoutes: OrchestratorRoute[];
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
export type LoopModuleInspectRequest = { package: unknown; source?: string };
export type LoopModuleInstallPlanRequest = { package: unknown; source: string; profileMappings?: Record<string, string> };
export type LoopModuleInstallCommitRequest = LoopModuleInstallPlanRequest & { expectedPlanHash: string };
export type LoopModuleExportRequest = {
  loopId: string;
  title?: string;
  description?: string;
  version?: string;
  category?: string;
  tags?: string[];
};

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
  getProjectGraphTransitions,
  getProjectRepairEdges,
  getProjectFailEdges,
  getProjectPassEdges,
  getProjectPassTargetJobId,
  getProjectValidationNode,
  getReachableProjectLoopGraph,
  getReachableProjectLoopIds,
  getReachableProjectJobNodeIds,
  hasReachableProjectWorkflowPass,
  isCalendarDate,
  isIanaTimeZone,
  isProjectAgentValidationNode,
  isProjectHumanValidationNode,
  isProjectHumanJobNode,
  isAllowedProjectRepairRoute,
  isProjectProviderJobNode,
  isProjectScheduledJobNode,
  loopNodeSizes,
  loopNodeSizeCatalog,
  loopNodeStyleCatalog,
  loopNodeStyles,
  maxJobRetriesLimit,
  maxLoopCapabilities,
  maxLoopCapabilityLength,
  maxProjectStateBytes,
  maxRepairAttemptsLimit,
  maxRepairDepthLimit,
  projectConfigurationVersion,
  resolveProjectWorkflowStartJob,
  workflowResults
} from "../domain/automation.js";
export { defaultLoopTheme } from "../domain/loopThemes.js";
export {
  maxControlFlowTransitions, maxReadStatePatchEvidenceBytes, maxReadStateRevisionMetadata,
  maxRuntimeJsonDepth, maxStatePatchBytes, maxStatePatchOperations
} from "../domain/runtime.js";
export {
  maxOrchestrationRequestEnvelopeBytes, maxRelevantHistoryBytes, maxRelevantHistoryEntries,
  maxResumeContextBytes, maxTaskEnvelopeBytes, taskEnvelopeVersion
} from "../domain/taskEnvelope.js";
export { automationConfigSchema, kebabCaseIdPattern } from "./workspace-schemas.js";
export { loopModulePackageV3Schema } from "./loop-module-schemas.js";

export type {
  MarkdownDocument, Project, ProjectInstruction, ProjectResourceIssue, ExecutionProfile,
  JsonValue, WorkflowResult, ProjectAutomationConfig, ProjectAutomationIssue, ProjectDocumentTreeNode,
  ProjectAgentValidationNode, ProjectAgentJobNode, ProjectExecutionComposition, ProjectHumanValidationNode, ProjectHumanJobNode,
  ProjectGraph, ProjectLoop, ProjectLoopCapabilities, ProjectGraphTransition, ProjectRepairEdge,
  ProjectLoopOrchestrator, ProjectLoopRepairRouter, ProjectLoopState, ProjectIssueTrackerConfig,
  ProjectNodeAppearance, ProjectFailEdge, ProjectJobNode, ProjectPassEdge, ProjectPassEdgeTarget,
  ProjectProviderJobNode, ProjectScheduledJobNode, ProjectValidationNode, ProjectWorkflow, ReachableProjectLoopGraph,
  LoopNodeSize, LoopNodeSizeDefinition, LoopNodeStyle, LoopNodeStyleDefinition, LoopNodeStyleGroup,
  LoopTheme, LoopThemeIssue,
  LoopEdgeLineStyle, LoopConnectionPointStyle, ProjectOnceJobSchedule, ProjectRecurringJobSchedule,
  ProjectScheduleCadence, ProjectScheduleWeekday, ProjectJobSchedule, LoopRun, LoopRunDetails, LoopRunStatus,
  LoopScheduleState, LoopRuntimePreflight,
  CanonicalNodeOutcome, ControlFlowEvent, LoopStateRevision, LoopStateRevisionMetadata, NodeRun, NodeRunRole, NodeRunStatus,
  OrchestrationFrame, OrchestrationRequest, OrchestratorNodeOutcome, OrchestratorRoute, RepairRequest, RepairResult, RootRun, RunCheck,
  StatePatch, ValidationNodeOutcome, JobRun, JobNodeOutcome,
  OrchestratorTaskEnvelopeV6, TaskEnvelopeHistoryEntry, TaskEnvelopeLoopIdentity,
  TaskEnvelopeOrchestrationRequest, TaskEnvelopeProviderRunIdentity, TaskEnvelopeRepairRequest,
  TaskEnvelopeRepairReturn, TaskEnvelopeResumeContext, TaskEnvelopeRouteCandidate,
  TaskEnvelopeRunIdentity, TaskEnvelopeState, TaskEnvelopeV6,
  TaskEnvelopeWorkflowNodeIdentity,
  ValidationTaskEnvelopeV6, JobTaskEnvelopeV6,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot,
  ExecutionResourceEvidence, RootExecutionSnapshot, ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask,
  LocalProviderStatus, LocalRuntime, RuntimeProvider, RuntimePreflightIssue, RuntimeConfigurationIssue,
  BalletMode, DashboardRunStatus, GraphOrchestrationStateV1, RootRunDetail, RootRunOrchestrationProjection, RootRunRepairProjection, RootRunReturnDestination,
  RootRunStateProjection, RootRunKind, RootRunListResponse, RootRunListState,
  RootRunSource, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, RespondToNodeRunRequest, StartRootRunRequest,
  WorkspaceInvalidationEvent, WorkspaceInvalidationInput, Skill
};
export type {
  InstalledLoopModuleStatus,
  LoopModuleExportResult,
  LoopModuleInspection,
  LoopModuleInstallPlan,
  LoopModuleLibraryEntry,
  LoopModulePackageV3
};
