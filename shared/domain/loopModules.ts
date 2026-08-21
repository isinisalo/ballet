import type {
  JsonValue,
  ProjectLoop,
  ProjectNodeAppearance,
  ProjectJobSchedule
} from "./automation.js";

export const loopModulePackageVersion = 3 as const;
export const maxLoopModulePackageBytes = 524_288;
export const maxLoopModuleResources = 64;
export const maxLoopModuleNodes = 64;
export const maxLoopModuleEdges = 128;
export const maxLoopModuleStringLength = 20_000;
export const maxLoopModuleResourceBodyBytes = 131_072;

export type LoopModuleNetworkRequirement = "required" | "forbidden" | "optional";
export type LoopModuleExternalWritesPermission = false | "requires-human-authorization";
export type LoopModuleProvenanceStatus = "exact" | "modified" | "missing-resources";
export type LoopModuleStateCompatibility = "compatible" | "incompatible" | "unknown";

export interface LoopModuleManifestV3 {
  id: string;
  title: string;
  description: string;
  version: string;
  category?: string;
  tags: string[];
}

export interface LoopModulePermissionsV3 {
  network: LoopModuleNetworkRequirement;
  externalWrites: LoopModuleExternalWritesPermission;
}

export interface LoopModuleProfileSlotV3 {
  key: string;
  title: string;
  description: string;
  providers: Array<"codex" | "copilot">;
  network: LoopModuleNetworkRequirement;
}

export interface LoopModuleExecutionCompositionV3 {
  profileSlot: string;
  primaryInstruction: string;
  skills: string[];
}

interface LoopModuleNodeBaseV3 extends ProjectNodeAppearance {
  key: string;
  description: string;
  task: string;
}

interface LoopModuleJobNodeBaseV3 extends LoopModuleNodeBaseV3 {
  validationNode: string;
  maxRetries: number;
}

export type LoopModuleJobNodeV3 =
  | (LoopModuleJobNodeBaseV3 & LoopModuleExecutionCompositionV3 & { type: "agent" })
  | (LoopModuleJobNodeBaseV3 & { type: "human" })
  | (LoopModuleJobNodeBaseV3 & LoopModuleExecutionCompositionV3 & {
      type: "scheduled";
      schedule: ProjectJobSchedule;
    });

export type LoopModuleValidationNodeV3 =
  | (LoopModuleNodeBaseV3 & LoopModuleExecutionCompositionV3 & { type: "agent" })
  | (LoopModuleNodeBaseV3 & { type: "human" });

export interface LoopModulePassEdgeV3 {
  key: string;
  sourceValidationNode: string;
  target: { jobNode: string } | { workflowResult: "PASS" };
}

export interface LoopModuleFailEdgeV3 {
  key: string;
  sourceValidationNode: string;
  target: { workflowResult: "FAIL" };
}

export interface LoopModuleWorkflowV3 {
  startJobNode: string;
  jobNodes: LoopModuleJobNodeV3[];
  validationNodes: LoopModuleValidationNodeV3[];
  passEdges: LoopModulePassEdgeV3[];
  failEdges: LoopModuleFailEdgeV3[];
}

export interface LoopModuleLoopV3 {
  key: string;
  description: string;
  state: { description: string; initial: JsonValue };
  workflow: LoopModuleWorkflowV3;
}

export type LoopModuleResourceV3 =
  | {
      kind: "instruction";
      key: string;
      title: string;
      metadata: Record<string, JsonValue>;
      body: string;
    }
  | {
      kind: "skill";
      key: string;
      name: string;
      description: string;
      metadata: Record<string, JsonValue>;
      body: string;
    };

export interface LoopModuleStateContractV3 {
  id: string;
  version: string;
  description: string;
  initial: JsonValue;
  requiredKeys: string[];
}

export interface LoopModuleRecommendedTransitionV3 {
  direction: "incoming" | "outgoing";
  decision: "PASS" | "FAIL";
  outcome: string;
  capability: string;
  description: string;
}

export interface LoopModuleRecommendedRepairV3 {
  direction: "incoming" | "outgoing";
  capability: string;
  description: string;
}

export interface LoopModuleCapabilitiesV3 {
  requires: string[];
  accepts: string[];
  provides: string[];
  recommendedTransitions: LoopModuleRecommendedTransitionV3[];
  recommendedRepairs: LoopModuleRecommendedRepairV3[];
}

export interface LoopModulePackageV3 {
  format: "ballet-loop-module";
  version: typeof loopModulePackageVersion;
  manifest: LoopModuleManifestV3;
  permissions: LoopModulePermissionsV3;
  profileSlots: LoopModuleProfileSlotV3[];
  stateContract: LoopModuleStateContractV3;
  capabilities: LoopModuleCapabilitiesV3;
  resources: LoopModuleResourceV3[];
  loop: LoopModuleLoopV3;
}

export type LoopModuleErrorCode =
  | "INVALID_JSON"
  | "INVALID_UTF8"
  | "PACKAGE_TOO_LARGE"
  | "SCHEMA_DOWNGRADE"
  | "INVALID_SCHEMA"
  | "UNKNOWN_FIELD"
  | "DUPLICATE_ID"
  | "FORBIDDEN_CONTENT"
  | "PROFILE_MAPPING_REQUIRED"
  | "PROFILE_INCOMPATIBLE"
  | "NETWORK_PERMISSION_MISMATCH"
  | "STATE_CONTRACT_INCOMPATIBLE"
  | "ID_CONFLICT"
  | "RESOURCE_CONFLICT"
  | "OWNERSHIP_CONFLICT"
  | "ACTIVE_RUN"
  | "PLAN_STALE"
  | "LOOP_NOT_FOUND"
  | "MODULE_NOT_INSTALLED";

export interface LoopModuleIssue {
  code: LoopModuleErrorCode;
  path: string;
  message: string;
}

export interface LoopModuleInspection {
  valid: boolean;
  package?: LoopModulePackageV3;
  sha256?: string;
  canonicalJson?: string;
  source: string;
  sizeBytes: number;
  issues: LoopModuleIssue[];
}

export interface LoopModuleIdRemapping {
  loop: Record<string, string>;
  nodes: Record<string, string>;
  edges: Record<string, string>;
  instructions: Record<string, string>;
  skills: Record<string, string>;
}

export interface LoopModuleProfileCandidate {
  id: string;
  name: string;
  provider: "codex" | "copilot";
  networkAccess: boolean;
}

export interface LoopModuleProfileMappingPlan {
  slot: LoopModuleProfileSlotV3;
  selectedProfileId?: string;
  candidates: LoopModuleProfileCandidate[];
  compatible: boolean;
  issue?: LoopModuleIssue;
}

export interface LoopModuleResourceWritePlan {
  kind: "instruction" | "skill";
  key: string;
  resourceId: string;
  relativePath: string;
  sha256: string;
  bytes: number;
  action: "create" | "conflict";
}

export interface LoopModuleConflict {
  kind: "id" | "resource" | "ownership";
  code: "ID_CONFLICT" | "RESOURCE_CONFLICT" | "OWNERSHIP_CONFLICT";
  target: string;
  message: string;
  blocking: boolean;
}

export interface LoopModuleInstallDiffSummary {
  loopsAdded: string[];
  projectFilesCreated: string[];
  provenanceFilesChanged: string[];
  projectConfigChanged: boolean;
}

export interface LoopModuleInstallPlan {
  planHash: string;
  packageSha256: string;
  source: string;
  module: Pick<LoopModuleManifestV3, "id" | "title" | "description" | "version" | "category" | "tags">;
  loop: ProjectLoop;
  idRemapping: LoopModuleIdRemapping;
  resources: LoopModuleResourceWritePlan[];
  profileMappings: LoopModuleProfileMappingPlan[];
  permissions: {
    externalWrites: LoopModuleExternalWritesPermission;
    network: LoopModuleNetworkRequirement;
    compatible: boolean;
  };
  stateContract: {
    contract: LoopModuleStateContractV3;
    compatibility: LoopModuleStateCompatibility;
    comparedWith: string[];
  };
  capabilities: {
    requires: string[];
    provides: string[];
    recommendedTransitions: LoopModuleRecommendedTransitionV3[];
    recommendedRepairs: LoopModuleRecommendedRepairV3[];
    available: string[];
    missingRequires: string[];
  };
  conflicts: LoopModuleConflict[];
  issues: LoopModuleIssue[];
  diff: LoopModuleInstallDiffSummary;
  requiresPreview: boolean;
  canInstall: boolean;
}

export interface LoopModuleOwnedResource {
  kind: "instruction" | "skill";
  resourceId: string;
  relativePath: string;
  installedSha256: string;
}

export interface InstalledLoopModuleV3 {
  moduleId: string;
  moduleVersion: string;
  title: string;
  source: string;
  packageSha256: string;
  loopId: string;
  installedAt: string;
  profileMappings: Record<string, string>;
  idRemapping: LoopModuleIdRemapping;
  stateContract: LoopModuleStateContractV3;
  capabilities: LoopModuleCapabilitiesV3;
  ownedResources: LoopModuleOwnedResource[];
  installedContentSha256: string;
}

export interface InstalledLoopModulesFileV3 {
  version: 3;
  installed: InstalledLoopModuleV3[];
}

export interface InstalledLoopModuleStatus extends InstalledLoopModuleV3 {
  status: LoopModuleProvenanceStatus;
  currentContentSha256?: string;
  missingResources: string[];
}

export interface LoopModuleLibraryEntry {
  source: string;
  sha256?: string;
  sizeBytes: number;
  valid: boolean;
  manifest?: LoopModuleManifestV3;
  permissions?: LoopModulePermissionsV3;
  package?: LoopModulePackageV3;
  issues: LoopModuleIssue[];
}

export interface LoopModuleExportResult {
  package: LoopModulePackageV3;
  canonicalJson: string;
  sha256: string;
  filename: string;
}
