import type { ActionDefinition, AgentComposition, StateDefinition } from "../../../shared/orchestration/environment.js";
import type { ExecutionSpecV13 } from "../../../shared/orchestration/execution.js";
import type { CreateAgentRunInput, ExecutionTaskSeed } from "../../../shared/orchestration/persistence.js";
import type { JsonValue } from "../../../shared/orchestration/primitives.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import type { WorkOutcome } from "../../../shared/orchestration/outcomes.js";
import type { StoredActionExecution, StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";
import type { TaskEnvelopeV11 } from "../../../shared/orchestration/taskEnvelopes.js";
import { taskEnvelopeV11Schema } from "../../../shared/orchestration/schemas/taskEnvelopeSchemas.js";
import { buildBoundedTaskContext } from "./TaskContextBuilder.js";
import { composeOrchestrationPrompt } from "./PromptComposer.js";
import { mapProviderPermissions, type ProviderPermissionSpec } from "./ProviderPermissions.js";

export interface PreparedAgentDispatch {
  agent: CreateAgentRunInput;
  task: ExecutionTaskSeed;
  permissions: ProviderPermissionSpec;
}

export class AgentDispatchFactory {
  constructor(private readonly nextId: (kind: string) => string) {}

  create(input: {
    run: StoredEnvironmentRun;
    action: StoredActionExecution;
    role: "validation" | "work";
    phase: "precheck" | "work" | "postwork";
    attempt: number;
    at: string;
    parentAgentRunId?: string;
    dynamicPrompt?: string;
    previousValidationFeedback?: string;
    workOutcome?: WorkOutcome;
  }): PreparedAgentDispatch {
    const { state, action } = findDefinitions(input.run, input.action.actionDefinitionId);
    const composition = input.role === "work" ? action.work : action.validation;
    const agentDefinition = input.run.executionSnapshot.agents.find(({ id }) => id === composition.agentId)!;
    const capability = input.run.executionSnapshot.runtimeCapabilities.find(
      ({ agentId }) => agentId === composition.agentId
    )!;
    const agentRunId = this.nextId(`${input.role}-${input.phase}`);
    const taskId = this.nextId("task");
    const outputSchemaId = `${input.role}-outcome-v11`;
    const context = buildBoundedTaskContext({
      snapshot: input.run.executionSnapshot, state, action, composition,
      actionStatus: input.action.status, workAttempt: input.action.workAttempt,
      maxRetries: input.action.maxRetries, humanInput: input.run.input,
      previousEvidence: input.workOutcome as unknown as JsonValue | undefined,
      approvalBoundary: { humanDecisionRequired: false }, outputSchemaId
    });
    const instruction = requireInstruction(input.run, composition);
    const base = {
      version: 11 as const, taskId, environmentRunId: input.run.environmentRunId,
      snapshotSha256: input.run.executionSnapshotHash, instruction, context,
      stateExecutionId: input.action.stateExecutionId, actionExecutionId: input.action.actionExecutionId,
      actionId: input.action.actionDefinitionId
    };
    const envelope: TaskEnvelopeV11 = input.phase === "precheck" ? {
      ...base, role: "validation", phase: "precheck", workAttempts: input.action.workAttempt,
      maxRetries: input.action.maxRetries
    } : input.phase === "work" ? {
      ...base, role: "work", phase: "work", workAttempt: input.attempt,
      dynamicPrompt: required(input.dynamicPrompt, "Work dispatch requires Validation's dynamic prompt."),
      ...(input.previousValidationFeedback ? { previousValidationFeedback: input.previousValidationFeedback } : {})
    } : {
      ...base, role: "validation", phase: "postwork", workAttempt: input.attempt,
      retriesRemaining: Math.max(0, input.action.maxRetries - Math.max(0, input.attempt - 1)),
      workOutcome: requiredOutcome(input.workOutcome) as unknown as JsonValue
    };
    const parsedEnvelope = taskEnvelopeV11Schema.parse(envelope);
    const evidence = composeOrchestrationPrompt({ snapshot: input.run.executionSnapshot, envelope: parsedEnvelope, composition });
    const spec: ExecutionSpecV13 = {
      version: 13, taskId, kind: "agent_execution", environmentRunId: input.run.environmentRunId,
      actionExecutionId: input.action.actionExecutionId, agentRunId, evidence,
      runtime: {
        agentId: agentDefinition.id, deviceId: capability.deviceId, runtimeBackendId: capability.runtimeBackendId,
        provider: capability.provider, cliVersion: capability.cliVersion, model: capability.model,
        reasoningEffort: capability.reasoningEffort, networkAccess: capability.networkAccess,
        capabilityHash: capability.capabilitySha256
      },
      project: {
        checkoutRoot: input.run.worktreePath, headSha: input.run.baseCommit,
        configHash: input.run.executionSnapshot.projectConfigSha256, snapshotHash: input.run.executionSnapshotHash
      },
      createdAt: input.at
    };
    return {
      agent: {
        agentRunId, environmentRunId: input.run.environmentRunId,
        actionExecutionId: input.action.actionExecutionId, parentAgentRunId: input.parentAgentRunId,
        role: input.role, phase: input.phase, attempt: input.attempt,
        taskEnvelope: parsedEnvelope,
        taskEnvelopeHash: sha256(canonicalJson(parsedEnvelope as unknown as JsonValue)), createdAt: input.at
      },
      task: { spec, specHash: sha256(canonicalJson(spec as unknown as JsonValue)) },
      permissions: mapProviderPermissions({
        provider: capability.provider, role: input.role,
        toolPolicy: input.role === "work" ? "workspace_write" : "read_only",
        networkAccess: capability.networkAccess, worktreePath: input.run.worktreePath
      })
    };
  }
}

const findDefinitions = (run: StoredEnvironmentRun, actionId: string): { state: StateDefinition; action: ActionDefinition } => {
  for (const state of run.executionSnapshot.environment.states) {
    const action = state.actions.find(({ id }) => id === actionId);
    if (action) return { state, action };
  }
  throw new Error(`Action ${actionId} is absent from immutable snapshot.`);
};
const requireInstruction = (run: StoredEnvironmentRun, composition: AgentComposition): string => {
  const resource = run.executionSnapshot.resources.find(
    ({ kind, id }) => kind === "instruction" && id === composition.instructionResource
  );
  if (!resource) throw new Error(`Instruction ${composition.instructionResource} is absent from immutable snapshot.`);
  return resource.content;
};
const required = (value: string | undefined, message: string): string => {
  if (!value?.trim()) throw new Error(message);
  return value;
};
const requiredOutcome = (value: WorkOutcome | undefined): WorkOutcome => {
  if (!value) throw new Error("Postwork Validation requires a persisted Work outcome.");
  return value;
};
