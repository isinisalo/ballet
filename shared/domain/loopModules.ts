import type {
  JsonValue,
  ProjectLoop,
  ProjectNodeAppearance,
  ProjectWorkSchedule
} from "./automation.js";

export const loopModulePackageVersion = 1 as const;
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

export interface LoopModuleManifestV1 {
  id: string;
  title: string;
  description: string;
  version: string;
  category?: string;
  tags: string[];
}

export interface LoopModulePermissionsV1 {
  network: LoopModuleNetworkRequirement;
  externalWrites: false;
}

export interface LoopModuleProfileSlotV1 {
  key: string;
  title: string;
  description: string;
  providers: Array<"codex" | "copilot">;
  network: LoopModuleNetworkRequirement;
}

export interface LoopModuleExecutionCompositionV1 {
  profileSlot: string;
  primaryInstruction: string;
  skills: string[];
}

interface LoopModuleNodeBaseV1 extends ProjectNodeAppearance {
  task: string;
}

export type LoopModuleWorkNodeV1 =
  | (LoopModuleNodeBaseV1 & LoopModuleExecutionCompositionV1 & { type: "agent" })
  | (LoopModuleNodeBaseV1 & { type: "human" })
  | (LoopModuleNodeBaseV1 & LoopModuleExecutionCompositionV1 & {
      type: "scheduled";
      schedule: ProjectWorkSchedule;
    });

export type LoopModuleValidationNodeV1 =
  | (LoopModuleNodeBaseV1 & LoopModuleExecutionCompositionV1 & { type: "agent" })
  | (LoopModuleNodeBaseV1 & { type: "human" });

export interface LoopModuleWorkLoopNodeV1 {
  key: string;
  description: string;
  work: LoopModuleWorkNodeV1;
  validation: LoopModuleValidationNodeV1;
  maxLocalAttempts: number;
}

export type LoopModuleEdgeTargetV1 = { node: string } | { terminal: "completed" | "blocked" | "failed" };

export interface LoopModuleNodeEdgeV1 {
  key: string;
  source: string;
  target: LoopModuleEdgeTargetV1;
}

export interface LoopModuleLoopV1 {
  key: string;
  description: string;
  state: { description: string; initial: JsonValue };
  startNode: string;
  nodes: LoopModuleWorkLoopNodeV1[];
  edges: LoopModuleNodeEdgeV1[];
}

export type LoopModuleResourceV1 =
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

export interface LoopModuleStateContractV1 {
  id: string;
  version: string;
  description: string;
  initial: JsonValue;
  requiredKeys: string[];
}

export interface LoopModuleRecommendedConnectionV1 {
  kind: LoopModuleConnectionKind;
  direction: "incoming" | "outgoing";
  capability: string;
  description: string;
}

export interface LoopModuleCapabilitiesV1 {
  requires: string[];
  accepts: string[];
  provides: string[];
  recommendedConnections: LoopModuleRecommendedConnectionV1[];
}

export interface LoopModulePackageV1 {
  format: "ballet-loop-module";
  version: typeof loopModulePackageVersion;
  manifest: LoopModuleManifestV1;
  permissions: LoopModulePermissionsV1;
  profileSlots: LoopModuleProfileSlotV1[];
  stateContract: LoopModuleStateContractV1;
  capabilities: LoopModuleCapabilitiesV1;
  resources: LoopModuleResourceV1[];
  loop: LoopModuleLoopV1;
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
  package?: LoopModulePackageV1;
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
  slot: LoopModuleProfileSlotV1;
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
  module: Pick<LoopModuleManifestV1, "id" | "title" | "description" | "version" | "category" | "tags">;
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
    contract: LoopModuleStateContractV1;
    compatibility: LoopModuleStateCompatibility;
    comparedWith: string[];
  };
  capabilities: {
    requires: string[];
    provides: string[];
    recommendedConnections: LoopModuleRecommendedConnectionV1[];
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

export interface InstalledLoopModuleV1 {
  moduleId: string;
  moduleVersion: string;
  title: string;
  source: string;
  packageSha256: string;
  loopId: string;
  installedAt: string;
  profileMappings: Record<string, string>;
  idRemapping: LoopModuleIdRemapping;
  stateContract: LoopModuleStateContractV1;
  capabilities: LoopModuleCapabilitiesV1;
  ownedResources: LoopModuleOwnedResource[];
  installedContentSha256: string;
}

export interface InstalledLoopModulesFileV1 {
  version: 1;
  installed: InstalledLoopModuleV1[];
}

export interface InstalledLoopModuleStatus extends InstalledLoopModuleV1 {
  status: LoopModuleProvenanceStatus;
  currentContentSha256?: string;
  missingResources: string[];
}

export interface LoopModuleLibraryEntry {
  source: string;
  sha256?: string;
  sizeBytes: number;
  valid: boolean;
  manifest?: LoopModuleManifestV1;
  permissions?: LoopModulePermissionsV1;
  package?: LoopModulePackageV1;
  issues: LoopModuleIssue[];
}

export interface LoopModuleExportResult {
  package: LoopModulePackageV1;
  canonicalJson: string;
  sha256: string;
  filename: string;
}
