import type { ContractIssue } from "@shared/orchestration/primitives";
import type { ProjectConfigurationV20 } from "@shared/orchestration/environment";

export interface ProjectRecord {
  path: string;
  config: ProjectConfigurationV20;
  configHash: string;
}

export interface ResourceDocument {
  kind: "goal" | "adr" | "constraint" | "use-case" | "instruction" | "skill";
  id: string;
  content: string;
  contentHash: string;
  value?: unknown;
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
  environment: ProjectConfigurationV20["environment"];
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
  goals: ResourceDocument[];
  adrs: ResourceDocument[];
  constraints: ResourceDocument[];
  useCases: ResourceDocument[];
  schedules: Array<Record<string, unknown>>;
}
