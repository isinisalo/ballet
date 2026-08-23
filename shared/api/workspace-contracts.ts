export {
  controlFlowEventSchema,
  graphStateRevisionMetadataSchema,
  nodeRunResponseBodySchema,
  repairFrameSchema,
  repairRequestSchema,
  repairResultSchema,
  rootRunListQuerySchema,
  rootRunOrchestrationProjectionSchema,
  rootRunRepairProjectionSchema,
  rootRunStateProjectionSchema,
  routingDecisionSchema,
  routingRequestSchema,
  validationNodeOutcomeSchema,
  workNodeOutcomeSchema,
  workspaceInvalidationEventSchema
} from "./runtime-schemas.js";

import type {
  CanvasNodeSize, CanvasNodeSizeDefinition, CanvasNodeStyle, CanvasNodeStyleDefinition, CanvasNodeStyleGroup,
  JsonValue, NodeResult, ProjectAgentValidationNode, ProjectAgentWorkNode, ProjectAutomationConfig,
  ProjectAutomationIssue, ProjectCandidateRouting, ProjectContinuationCandidateRule, ProjectExecutionComposition,
  ProjectGraph, ProjectGraphNode, ProjectGraphNodeDecisionStrategyV2, ProjectGraphNodeRouteTarget, ProjectGraphRouteTarget, ProjectHumanValidationNode,
  ProjectHumanWorkNode, ProjectJobNode, ProjectNodeAppearance, ProjectNodeCapabilities, ProjectOrchestrator,
  ProjectRepairCandidateRule, ProjectRepairNode, ProjectRouteCandidate, ProjectStartCandidateRule, ProjectIntrinsicOutcome,
  ProjectStateContract, ProjectStateDefinition, ProjectValidationNode, ProjectWorkNode
} from "../domain/automation.js";
import type { CanvasConnectionLineStyle, CanvasConnectionPointStyle, CanvasTheme, CanvasThemeIssue } from "../domain/canvasTheme.js";
import type { MarkdownDocument, Project, ProjectDocumentTreeNode, ProjectInstruction, ProjectResourceIssue, Skill } from "../domain/documents.js";
import type { ExecutionProfile, ProjectIssueTrackerConfig } from "../domain/projectConfig.js";
import type {
  CanonicalNodeOutcome, ControlFlowEvent, ExecutionEvent, ExecutionEventPage, ExecutionPolicy,
  ExecutionProjectSnapshot, ExecutionResourceEvidence, ExecutionRuntimeSnapshot, ExecutionSpec, ExecutionTask,
  GraphNodeInvocation, GraphNodeInvocationDetails, GraphNodeRuntimePreflight, GraphStateRevision,
  GraphStateRevisionMetadata, JobNodeInvocation, LocalProviderStatus, LocalRuntime, NodeRun, NodeRunRole,
  NodeRunStatus, OrchestrationScope, OrchestratorNodeOutcome, RepairFrame, RepairNodeOutcome, RepairRequest,
  RepairResult, RootExecutionSnapshot, RootRun, RoutingDecision, RoutingRequest, RunCheck,
  RuntimeConfigurationIssue, RuntimePreflightIssue, RuntimeProvider, StatePatch, ValidationNodeOutcome, WorkNodeOutcome
} from "../domain/runtime.js";
import type {
  OrchestratorTaskEnvelopeV8, RepairTaskEnvelopeV8, TaskEnvelopeHistoryEntry, TaskEnvelopeNodeIdentity,
  TaskEnvelopeResumeContext, TaskEnvelopeRouteCandidate, TaskEnvelopeRunIdentity, TaskEnvelopeState,
  TaskEnvelopeV8, ValidationTaskEnvelopeV8, WorkTaskEnvelopeV8, TaskEnvelopeOutcomeCandidate
} from "../domain/taskEnvelope.js";
import type {
  BalletMode, DashboardRunStatus, RespondToNodeRunRequest, RootRunDetail, RootRunKind, RootRunListResponse,
  RootRunListState, RootRunOrchestrationProjection, RootRunRepairProjection, RootRunStateProjection,
  RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, StartRootRunRequest,
  WorkspaceInvalidationEvent, WorkspaceInvalidationInput
} from "../domain/runs.js";
import type {
  GraphNodeModuleExportResult, GraphNodeModuleInspection, GraphNodeModuleInstallPlan,
  GraphNodeModuleLibraryEntry, GraphNodeModulePackageV5, InstalledGraphNodeModuleStatus
} from "../domain/graphNodeModules.js";
import type {
  DecisionFeatureDefinitionV2, DecisionOptionModelRowV2, DecisionStateDefinitionV2,
  ExecutionGraphOccurrenceV3, PolicyCostMeasureV1, PolicyDecisionRecordV2, PolicyPreviewResultV2, PolicyPreviewV2,
  PolicyProjectionEdgeV2, PolicyProjectionNodeV2, PolicyProjectionV2, PolicyTelemetryV3, ProjectCapabilityModelV2,
  ProjectGraphDecisionStrategyV2, ProjectSspDecisionModelV2, ProjectSspDecisionStrategyV2, SspActionValueV2
} from "../domain/decisionModel.js";

export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;
export interface WorkspaceDataDto {
  project: Project;
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  resourceIssues: ProjectResourceIssue[];
  graphNodeInvocations: GraphNodeInvocationDetails[];
  activeRootRuns: RootRun[];
  routingDecisions: RoutingDecision[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  canvasTheme: CanvasTheme;
  canvasThemeIssues: CanvasThemeIssue[];
  runtime: LocalRuntime;
  runtimeConfigurationIssues: RuntimeConfigurationIssue[];
  runTargets: RunTargetsResponse;
  projectDocumentTree?: ProjectDocumentTreeNode[];
}
export type WorkspaceCollectionName = "skills";
type ServerManagedEntityField = "relativePath" | "slug" | "errors" | "projectId" | "origin" | "valid" | "sourceSha256" | "contentSha256" | "sizeBytes";
export type SkillSaveRequest = Omit<Partial<Skill>, ServerManagedEntityField>;
export type ExecutionProfileSaveRequest = Omit<ExecutionProfile, "id">;
export type WorkspaceAutomationResponseDto = { config: ProjectAutomationConfig; issues: ProjectAutomationIssue[] };
export type PolicyPreviewRequestV2 = {
  config: ProjectAutomationConfig;
  scope: "graph" | "graph_node";
  graphNodeId?: string;
};
export type GraphNodeModuleInspectRequest = { package: unknown; source?: string };
export type GraphNodeModuleInstallPlanRequest = { package: unknown; source: string; profileMappings?: Record<string, string> };
export type GraphNodeModuleInstallCommitRequest = GraphNodeModuleInstallPlanRequest & { expectedPlanHash: string };
export type GraphNodeModuleExportRequest = {
  graphNodeId: string; title?: string; description?: string; version?: string; category?: string; tags?: string[];
};
export type WorkspaceSaveRequestByCollection = { skills: SkillSaveRequest };
export type WorkspaceSaveResponseByCollection = { [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number] };
export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export {
  canvasNodeSizes, canvasNodeSizeCatalog, canvasNodeStyleCatalog, canvasNodeStyles,
  defaultCanvasNodeSize, defaultCanvasNodeStyle, defaultProjectAutomationConfig, defaultProjectOrchestrator,
  isProjectAgentValidationNode, isProjectAgentWorkNode, isProjectHumanValidationNode, isProjectHumanWorkNode,
  maxGraphNodeJobNodes, maxJobRetriesLimit, maxNodeCapabilities, maxNodeCapabilityLength,
  maxOrchestratorTransitions, maxProjectGraphNodes, maxProjectStateBytes, maxRepairAttemptsLimit,
  maxRepairDepthLimit, maxRouteAttemptsLimit, nodeResults, projectConfigurationVersion, routeTargetKey
} from "../domain/automation.js";
export { defaultCanvasTheme } from "../domain/canvasTheme.js";
export { maxControlFlowTransitions, maxReadStatePatchEvidenceBytes, maxReadStateRevisionMetadata, maxRuntimeJsonDepth, maxStatePatchBytes, maxStatePatchOperations } from "../domain/runtime.js";
export { maxRelevantHistoryBytes, maxRelevantHistoryEntries, maxResumeContextBytes, maxRoutingRequestEnvelopeBytes, maxTaskEnvelopeBytes, taskEnvelopeVersion } from "../domain/taskEnvelope.js";
export {
  automationConfigSchema,
  kebabCaseIdPattern,
  projectValidationNodeSchema,
  projectWorkNodeSchema
} from "./workspace-schemas.js";
export { graphNodeModulePackageV5Schema } from "./graph-node-module-schemas.js";

export type {
  MarkdownDocument, Project, ProjectInstruction, ProjectResourceIssue, ExecutionProfile, JsonValue, NodeResult,
  ProjectAutomationConfig, ProjectAutomationIssue, ProjectDocumentTreeNode, ProjectAgentValidationNode,
  ProjectAgentWorkNode, ProjectCandidateRouting, ProjectContinuationCandidateRule, ProjectExecutionComposition,
  ProjectGraph, ProjectGraphNode, ProjectGraphNodeRouteTarget, ProjectGraphRouteTarget, ProjectHumanValidationNode,
  ProjectHumanWorkNode, ProjectIssueTrackerConfig, ProjectJobNode, ProjectNodeAppearance, ProjectNodeCapabilities,
  ProjectOrchestrator, ProjectRepairCandidateRule, ProjectRepairNode, ProjectRouteCandidate, ProjectStartCandidateRule,
  ProjectStateContract, ProjectStateDefinition, ProjectValidationNode, ProjectWorkNode,
  ProjectGraphNodeDecisionStrategyV2, ProjectIntrinsicOutcome,
  CanvasNodeSize, CanvasNodeSizeDefinition, CanvasNodeStyle, CanvasNodeStyleDefinition, CanvasNodeStyleGroup,
  CanvasTheme, CanvasThemeIssue, CanvasConnectionLineStyle, CanvasConnectionPointStyle,
  CanonicalNodeOutcome, ControlFlowEvent, GraphStateRevision, GraphStateRevisionMetadata, NodeRun, NodeRunRole,
  NodeRunStatus, OrchestrationScope, OrchestratorNodeOutcome, RepairNodeOutcome, RepairRequest, RepairResult,
  RepairFrame, RootRun, RoutingDecision, RoutingRequest, RunCheck, StatePatch, ValidationNodeOutcome, WorkNodeOutcome,
  GraphNodeInvocation, GraphNodeInvocationDetails, JobNodeInvocation, GraphNodeRuntimePreflight,
  ExecutionPolicy, ExecutionProjectSnapshot, ExecutionRuntimeSnapshot, ExecutionResourceEvidence, RootExecutionSnapshot,
  ExecutionEvent, ExecutionEventPage, ExecutionSpec, ExecutionTask, LocalProviderStatus, LocalRuntime, RuntimeProvider,
  RuntimePreflightIssue, RuntimeConfigurationIssue, BalletMode, DashboardRunStatus, RootRunDetail,
  RootRunOrchestrationProjection, RootRunRepairProjection, RootRunStateProjection, RootRunKind, RootRunListResponse,
  RootRunListState, RootRunSummary, RunTarget, RunTargetIssue, RunTargetsResponse, RespondToNodeRunRequest,
  StartRootRunRequest, WorkspaceInvalidationEvent, WorkspaceInvalidationInput, Skill,
  TaskEnvelopeHistoryEntry, TaskEnvelopeNodeIdentity, TaskEnvelopeResumeContext, TaskEnvelopeRouteCandidate,
  TaskEnvelopeRunIdentity, TaskEnvelopeState, TaskEnvelopeV8, WorkTaskEnvelopeV8, ValidationTaskEnvelopeV8,
  OrchestratorTaskEnvelopeV8, RepairTaskEnvelopeV8, TaskEnvelopeOutcomeCandidate,
  InstalledGraphNodeModuleStatus, GraphNodeModuleExportResult, GraphNodeModuleInspection,
  GraphNodeModuleInstallPlan, GraphNodeModuleLibraryEntry, GraphNodeModulePackageV5
  , DecisionFeatureDefinitionV2, DecisionOptionModelRowV2, DecisionStateDefinitionV2,
  ExecutionGraphOccurrenceV3, PolicyCostMeasureV1, PolicyDecisionRecordV2, PolicyPreviewResultV2, PolicyPreviewV2,
  PolicyProjectionEdgeV2, PolicyProjectionNodeV2, PolicyProjectionV2, PolicyTelemetryV3, ProjectCapabilityModelV2,
  ProjectGraphDecisionStrategyV2, ProjectSspDecisionModelV2, ProjectSspDecisionStrategyV2, SspActionValueV2
};
