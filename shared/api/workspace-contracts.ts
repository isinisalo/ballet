import type { ProjectAutomationConfig, ProjectAutomationIssue } from "../domain/automation.js";
import type { CanvasTheme, CanvasThemeIssue } from "../domain/canvasTheme.js";
import type {
  MarkdownDocument,
  Project,
  ProjectDocumentTreeNode,
  ProjectInstruction,
  ProjectResourceIssue,
  Skill
} from "../domain/documents.js";
import type { ExecutionProfile } from "../domain/projectConfig.js";
import type { GraphNodeInvocationDetails, LocalRuntime, RuntimeConfigurationIssue } from "../domain/runtime.js";
import type { RunTargetsResponse } from "../domain/runs.js";
import type {
  GraphNodeModuleExportResult,
  GraphNodeModuleInspection,
  GraphNodeModuleInstallPlan,
  GraphNodeModuleLibraryEntry,
  InstalledGraphNodeModuleStatus
} from "../domain/graphNodeModules.js";

export {
  controlFlowEventSchema,
  graphStateRevisionMetadataSchema,
  nodeRunResponseBodySchema,
  rootRunListQuerySchema,
  rootRunOrchestrationProjectionSchema,
  rootRunStateProjectionSchema,
  validationNodeOutcomeSchema,
  workNodeOutcomeSchema,
  workspaceInvalidationEventSchema
} from "./runtime-schemas.js";

export interface WorkspaceDataDto {
  project: Project;
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  resourceIssues: ProjectResourceIssue[];
  graphNodeInvocations: GraphNodeInvocationDetails[];
  activeRootRuns: import("../domain/runtime.js").RootRun[];
  automation: ProjectAutomationConfig;
  automationIssues: ProjectAutomationIssue[];
  canvasTheme: CanvasTheme;
  canvasThemeIssues: CanvasThemeIssue[];
  runtime: LocalRuntime;
  runtimeConfigurationIssues: RuntimeConfigurationIssue[];
  runTargets: RunTargetsResponse;
  projectDocumentTree?: ProjectDocumentTreeNode[];
}

export type ProjectDocumentCreateRequest = { directoryPath: string; title: string };
export type ProjectDocumentSaveRequest = Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">;
export type WorkspaceCollectionName = "skills";
type ServerManagedEntityField = "relativePath" | "slug" | "errors" | "projectId" | "origin"
  | "valid" | "sourceSha256" | "contentSha256" | "sizeBytes";
export type SkillSaveRequest = Omit<Partial<Skill>, ServerManagedEntityField>;
export type ExecutionProfileSaveRequest = Omit<ExecutionProfile, "id">;
export type WorkspaceAutomationResponseDto = { config: ProjectAutomationConfig; issues: ProjectAutomationIssue[] };
export type PolicyPreviewRequestV4 = {
  config: ProjectAutomationConfig;
  scope: "graph" | "graph_node";
  graphNodeId?: string;
};
export type GraphNodeModuleInspectRequest = { package: unknown; source?: string };
export type GraphNodeModuleInstallPlanRequest = {
  package: unknown;
  source: string;
  profileMappings?: Record<string, string>;
};
export type GraphNodeModuleInstallCommitRequest = GraphNodeModuleInstallPlanRequest & { expectedPlanHash: string };
export type GraphNodeModuleExportRequest = {
  graphNodeId: string;
  title?: string;
  description?: string;
  version?: string;
  category?: string;
  tags?: string[];
};
export type WorkspaceSaveRequestByCollection = { skills: SkillSaveRequest };
export type WorkspaceSaveResponseByCollection = { [K in WorkspaceCollectionName]: WorkspaceDataDto[K][number] };
export type AppData = WorkspaceDataDto;
export type CollectionName = WorkspaceCollectionName;

export {
  canvasNodeSizes,
  canvasNodeSizeCatalog,
  canvasNodeStyleCatalog,
  canvasNodeStyles,
  defaultCanvasNodeSize,
  defaultCanvasNodeStyle,
  defaultProjectAutomationConfig,
  isProjectAgentValidationNode,
  isProjectAgentWorkNode,
  isProjectHumanValidationNode,
  isProjectHumanWorkNode,
  maxGraphNodeActionNodes,
  maxActionRetriesLimit,
  maxNodeCapabilities,
  maxNodeCapabilityLength,
  maxProjectGraphNodes,
  maxProjectStateBytes,
  nodeResults,
  projectConfigurationVersion
} from "../domain/automation.js";
export { defaultCanvasTheme } from "../domain/canvasTheme.js";
export {
  maxControlFlowTransitions,
  maxReadStatePatchEvidenceBytes,
  maxReadStateRevisionMetadata,
  maxRuntimeJsonDepth,
  maxStatePatchBytes,
  maxStatePatchOperations
} from "../domain/runtime.js";
export {
  maxRelevantHistoryBytes,
  maxRelevantHistoryEntries,
  maxResumeContextBytes,
  maxTaskEnvelopeBytes,
  taskEnvelopeVersion
} from "../domain/taskEnvelope.js";
export {
  automationConfigSchema,
  kebabCaseIdPattern,
  projectValidationNodeSchema,
  projectWorkNodeSchema
} from "./workspace-schemas.js";
export { graphNodeModulePackageV7Schema } from "./graph-node-module-schemas.js";

export type * from "../domain/automation.js";
export type * from "../domain/canvasTheme.js";
export type * from "../domain/decisionModel.js";
export type * from "../domain/documents.js";
export type * from "../domain/executionRuntime.js";
export type * from "../domain/graphNodeModules.js";
export type * from "../domain/projectConfig.js";
export type * from "../domain/runs.js";
export type * from "../domain/runtime.js";
export type * from "../domain/taskEnvelope.js";

export type {
  GraphNodeModuleExportResult,
  GraphNodeModuleInspection,
  GraphNodeModuleInstallPlan,
  GraphNodeModuleLibraryEntry,
  InstalledGraphNodeModuleStatus
};
