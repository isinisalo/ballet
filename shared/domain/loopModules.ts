import type {
  JsonValue,
  ProjectLoop,
  ProjectNodeAppearance,
  ProjectJobSchedule
} from "./automation.js";

export const loopModulePackageVersion = 2 as const;
export const maxLoopModulePackageBytes = 524_288;
export const maxLoopModuleResources = 64;
export const maxLoopModuleNodes = 64;
export const maxLoopModuleEdges = 128;
export const maxLoopModuleStringLength = 20_000;
export const maxLoopModuleResourceBodyBytes = 131_072;

export type LoopModuleNetworkRequirement = "required" | "forbidden" | "optional";
export type LoopModuleConnectionKind = "flow" | "repair";
export type LoopModuleProvenanceStatus = "exact" | "modified" | "missing-resources";
export type LoopModuleStateCompatibility = "compatible" | "incompatible" | "unknown";

export interface LoopModuleManifestV2 {
  id: string;
  title: string;
  description: string;
  version: string;
  category?: string;
  tags: string[];
}

export interface LoopModulePermissionsV2 {
  network: LoopModuleNetworkRequirement;
  externalWrites: false;
}

export interface LoopModuleProfileSlotV2 {
  key: string;
  title: string;
  description: string;
  providers: Array<"codex" | "copilot">;
  network: LoopModuleNetworkRequirement;
}

export interface LoopModuleExecutionCompositionV2 {
  profileSlot: string;
  primaryInstruction: string;
  skills: string[];
}

interface LoopModuleNodeBaseV2 extends ProjectNodeAppearance {
  key: string;
  description: string;
  task: string;
}

interface LoopModuleJobNodeBaseV2 extends LoopModuleNodeBaseV2 {
  validationNode: string;
  maxRetries: number;
}

export type LoopModuleJobNodeV2 =
  | (LoopModuleJobNodeBaseV2 & LoopModuleExecutionCompositionV2 & { type: "agent" })
  | (LoopModuleJobNodeBaseV2 & { type: "human" })
  | (LoopModuleJobNodeBaseV2 & LoopModuleExecutionCompositionV2 & {
      type: "scheduled";
      schedule: ProjectJobSchedule;
    });

export type LoopModuleValidationNodeV2 =
  | (LoopModuleNodeBaseV2 & LoopModuleExecutionCompositionV2 & { type: "agent" })
  | (LoopModuleNodeBaseV2 & { type: "human" });

export interface LoopModulePassEdgeV2 {
  key: string;
  sourceValidationNode: string;
  target: { jobNode: string } | { workflowResult: "PASS" };
}

export interface LoopModuleFailEdgeV2 {
  key: string;
  sourceValidationNode: string;
  target: { workflowResult: "FAIL" };
}

export interface LoopModuleWorkflowV2 {
  startJobNode: string;
  jobNodes: LoopModuleJobNodeV2[];
  validationNodes: LoopModuleValidationNodeV2[];
  passEdges: LoopModulePassEdgeV2[];
  failEdges: LoopModuleFailEdgeV2[];
}

export interface LoopModuleLoopV2 {
  key: string;
  description: string;
  state: { description: string; initial: JsonValue };
  workflow: LoopModuleWorkflowV2;
}

export type LoopModuleResourceV2 =
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

export interface LoopModuleStateContractV2 {
  id: string;
  version: string;
  description: string;
  initial: JsonValue;
  requiredKeys: string[];
}

export interface LoopModuleRecommendedConnectionV2 {
  kind: LoopModuleConnectionKind;
  direction: "incoming" | "outgoing";
  capability: string;
  description: string;
}

export interface LoopModuleCapabilitiesV2 {
  requires: string[];
  accepts: string[];
  provides: string[];
  recommendedConnections: LoopModuleRecommendedConnectionV2[];
}

export interface LoopModulePackageV2 {
  format: "ballet-loop-module";
  version: typeof loopModulePackageVersion;
  manifest: LoopModuleManifestV2;
  permissions: LoopModulePermissionsV2;
  profileSlots: LoopModuleProfileSlotV2[];
  stateContract: LoopModuleStateContractV2;
  capabilities: LoopModuleCapabilitiesV2;
  resources: LoopModuleResourceV2[];
  loop: LoopModuleLoopV2;
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
  package?: LoopModulePackageV2;
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
  slot: LoopModuleProfileSlotV2;
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
  module: Pick<LoopModuleManifestV2, "id" | "title" | "description" | "version" | "category" | "tags">;
  loop: ProjectLoop;
  idRemapping: LoopModuleIdRemapping;
  resources: LoopModuleResourceWritePlan[];
  profileMappings: LoopModuleProfileMappingPlan[];
  permissions: {
    externalWrites: false;
    network: LoopModuleNetworkRequirement;
    compatible: boolean;
  };
  stateContract: {
    contract: LoopModuleStateContractV2;
    compatibility: LoopModuleStateCompatibility;
    comparedWith: string[];
  };
  capabilities: {
    requires: string[];
    provides: string[];
    recommendedConnections: LoopModuleRecommendedConnectionV2[];
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

export interface InstalledLoopModuleV2 {
  moduleId: string;
  moduleVersion: string;
  title: string;
  source: string;
  packageSha256: string;
  loopId: string;
  installedAt: string;
  profileMappings: Record<string, string>;
  idRemapping: LoopModuleIdRemapping;
  stateContract: LoopModuleStateContractV2;
  capabilities: LoopModuleCapabilitiesV2;
  ownedResources: LoopModuleOwnedResource[];
  installedContentSha256: string;
}

export interface InstalledLoopModulesFileV2 {
  version: 2;
  installed: InstalledLoopModuleV2[];
}

export interface InstalledLoopModuleStatus extends InstalledLoopModuleV2 {
  status: LoopModuleProvenanceStatus;
  currentContentSha256?: string;
  missingResources: string[];
}

export interface LoopModuleLibraryEntry {
  source: string;
  sha256?: string;
  sizeBytes: number;
  valid: boolean;
  manifest?: LoopModuleManifestV2;
  permissions?: LoopModulePermissionsV2;
  package?: LoopModulePackageV2;
  issues: LoopModuleIssue[];
}

export interface LoopModuleExportResult {
  package: LoopModulePackageV2;
  canonicalJson: string;
  sha256: string;
  filename: string;
}
