import type { ContractIssue } from "@shared/orchestration/primitives";
import type { ActionAgentDefinition, GovernanceAgentDefinition, GovernanceAgentId, ProjectConfigurationV26 } from "@shared/orchestration/environment";

export interface ProjectRecord {
  path: string;
  config: ProjectConfigurationV26;
  configHash: string;
}

export interface ResourceDocument {
  kind: "overview" | "adr" | "instruction" | "skill";
  id: string;
  content: string;
  contentHash: string;
}

export interface GovernanceAgentSlot {
  id: GovernanceAgentId;
  relativePath: string;
  status: "ready" | "missing" | "invalid";
  contentHash?: string;
  agent?: GovernanceAgentDefinition;
  error?: string;
  skillResources: string[];
}
export interface GovernanceAgentsResponse { configHash: string; agents: GovernanceAgentSlot[] }

export interface ActionAgentSlot {
  id: string; relativePath: string; status: "ready"; contentHash: string; agent: ActionAgentDefinition;
}
export interface ActionResponse {
  action: ProjectConfigurationV26["environment"]["states"][number]["actions"][number]; configHash: string;
  validationAgent: ActionAgentSlot; workAgent: ActionAgentSlot;
}

export interface ReferenceEntry {
  kind: string;
  id: string;
  references: Array<{ ownerType: string; ownerId: string; field: string }>;
}

export interface ReferenceIndexResponse {
  entries: ReferenceEntry[];
  runReferences: Array<{ kind: string; id: string; runIds: string[] }>;
  activeRunIds: string[];
}

export interface EnvironmentResponse {
  environment: ProjectConfigurationV26["environment"];
  configHash: string;
  readinessIssues: ContractIssue[];
  activeRunIds: string[];
  locked: boolean;
}

export interface OrchestrationConfigureData {
  project: ProjectRecord;
  references: ReferenceIndexResponse;
  instructions: ResourceDocument[];
  skills: ResourceDocument[];
  overview?: ResourceDocument;
  adrs: ResourceDocument[];
  agents: GovernanceAgentsResponse;
}
