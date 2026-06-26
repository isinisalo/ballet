import type { VersionedRef } from "./json.js";
import type { MappingExpression } from "./mapping.js";

export type FlowHealth = "ready" | "warning" | "invalid";
export type FlowDiagnosticSeverity = "error" | "warning" | "info";

export interface FlowDiagnostic {
  severity: FlowDiagnosticSeverity;
  title: string;
  explanation: string;
  affectedResource: {
    type: "loop" | "event" | "routing-policy" | "operation" | "agent" | "emission-policy" | "contract";
    id: string;
    version?: number;
  };
  suggestedFix?: string;
}

export interface FlowEventNode {
  kind: "event";
  id: string;
  eventType: string;
  name: string;
  description: string;
  dataContract?: VersionedRef;
  active: boolean;
}

export interface FlowOperationNode {
  kind: "operation";
  id: string;
  operationId: string;
  version: number;
  name: string;
  description: string;
  agentId: string;
  agentName?: string;
  inputContract: VersionedRef;
  outputContract: VersionedRef;
  active: boolean;
}

export interface FlowRoutingEdge {
  kind: "routing";
  id: string;
  from: string;
  to: string;
  policyId: string;
  policyName: string;
  active: boolean;
}

export interface FlowEmissionEdge {
  kind: "emission";
  id: string;
  from: string;
  to: string;
  policyId: string;
  policyVersion: number;
  slot: string;
  policyName: string;
  active: boolean;
}

export interface FlowViewModel {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  entryEvents: FlowEventNode[];
  terminalEvents: FlowEventNode[];
  nodes: Array<FlowEventNode | FlowOperationNode>;
  edges: Array<FlowRoutingEdge | FlowEmissionEdge>;
  safetyLimits: {
    maxHops: number;
    maxRuns: number;
    maxIterationsPerStep: number;
    deadlineSeconds?: number;
  };
  diagnostics: FlowDiagnostic[];
  health: FlowHealth;
}

export interface DataShapeFieldDraft {
  name: string;
  label?: string;
  description?: string;
  type: "text" | "number" | "boolean" | "text-list" | "number-list" | "object" | "object-list";
  required?: boolean;
  allowedValues?: string[];
  default?: unknown;
  example?: unknown;
}

export interface FlowResultEventDraft {
  eventId?: string;
  name?: string;
  description?: string;
  fields?: DataShapeFieldDraft[];
  subjectField?: string;
  requireSummaryGate?: boolean;
  onGateFailure?: "skip" | "fail_run";
}

export interface FlowSafetyLimitsDraft {
  maxHops?: number;
  maxRuns?: number;
  maxIterationsPerStep?: number;
  deadlineSeconds?: number;
}

export interface FlowLimitExceededDraft {
  enabled?: boolean;
  eventId?: string;
  name?: string;
  description?: string;
}

export interface FlowAgentTaskDraft {
  operationId?: string;
  agentId?: string;
  name?: string;
  instructions?: string;
  inputFields?: DataShapeFieldDraft[];
  resultFields?: DataShapeFieldDraft[];
  inputMapping?: MappingExpression;
  resultEvent?: FlowResultEventDraft;
}

export interface FlowCreateDraft {
  id?: string;
  name: string;
  purpose: string;
  description?: string;
  trigger?: {
    eventId?: string;
    name?: string;
    description?: string;
    fields?: DataShapeFieldDraft[];
    example?: Record<string, unknown>;
  };
  agentTask?: FlowAgentTaskDraft;
  inputMapping?: MappingExpression;
  resultEvent?: FlowResultEventDraft;
  followUpTasks?: FlowAgentTaskDraft[];
  safetyLimits?: FlowSafetyLimitsDraft;
  limitExceeded?: FlowLimitExceededDraft;
  active?: boolean;
}

export interface FlowSettingsUpdateDraft {
  name?: string;
  description?: string;
  safetyLimits?: FlowSafetyLimitsDraft;
  limitExceeded?: FlowLimitExceededDraft;
}

export interface WorkspaceReference {
  type: "contract" | "event" | "operation" | "routing-policy" | "emission-policy" | "loop" | "agent" | "runtime" | "skill";
  id: string;
  version?: number;
  label: string;
}

export interface WorkspaceDiagnostic {
  severity: FlowDiagnosticSeverity;
  title: string;
  explanation: string;
  resource: WorkspaceReference;
  suggestedFix?: string;
}

export interface WorkspaceValidationResult {
  valid: boolean;
  diagnostics: WorkspaceDiagnostic[];
}

export interface SafeDeleteResult {
  allowed: boolean;
  references: WorkspaceReference[];
  diagnostics: WorkspaceDiagnostic[];
}

export interface FlowDraftTestResult {
  matched: boolean;
  trigger: {
    name: string;
    summary: string;
    exampleData: Record<string, unknown>;
  };
  operationInputs: Array<{
    taskName: string;
    agentName?: string;
    status: string;
    summary: string;
    input: Record<string, unknown>;
  }>;
  exampleOutputs: Array<{
    taskName: string;
    status: string;
    summary: string;
    result: Record<string, unknown>;
  }>;
  resultBranches: Array<{
    taskName: string;
    branchName: string;
    matched: boolean;
    summary: string;
    gateSummary: string;
    gateFailureBehavior: string;
  }>;
  emittedEvents: Array<{
    name: string;
    eventType: string;
    subject?: string;
    summary: string;
    data: Record<string, unknown>;
  }>;
  downstreamTasks: Array<{
    taskName: string;
    agentName?: string;
    summary: string;
  }>;
  diagnostics: FlowDiagnostic[];
  trace: Array<{
    title: string;
    summary: string;
  }>;
}

export interface FlowComposerResult {
  resources: unknown;
  validation: WorkspaceValidationResult;
  flow?: FlowViewModel;
  test?: FlowDraftTestResult;
}

export interface FlowTestResult {
  flowId: string;
  matched: boolean;
  trace: Array<{
    title: string;
    summary: string;
  }>;
  routing: unknown;
  simulation?: FlowDraftTestResult;
  diagnostics: FlowDiagnostic[];
}

export type TraceScope = "correlation" | "loop" | "run";
export type TraceEntryKind =
  | "event_received"
  | "routing_matched"
  | "routing_skipped"
  | "input_mapped"
  | "input_validated"
  | "agent_queued"
  | "agent_started"
  | "agent_completed"
  | "agent_blocked"
  | "agent_needs_input"
  | "agent_failed"
  | "emission_evaluated"
  | "gate_passed"
  | "gate_failed"
  | "event_emitted"
  | "loop_completed"
  | "loop_exhausted"
  | "log";

export interface TraceEntry {
  id: string;
  at: string;
  scope: TraceScope;
  kind: TraceEntryKind;
  title: string;
  summary: string;
  status?: string;
  eventId?: string;
  runId?: string;
  loopInstanceId?: string;
  technicalDetails?: Record<string, unknown>;
}

export interface TraceViewModel {
  scope: TraceScope;
  id: string;
  entries: TraceEntry[];
}
