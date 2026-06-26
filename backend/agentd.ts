import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent, AgentRun, AppData, RuntimeEvent } from "./shared/domain.js";
import type { AgentOperation } from "./shared/operations.js";
import type { JsonValue } from "./shared/json.js";
import { ContractRegistry, ContractRegistryError, contractSchemaHash } from "./shared/contracts.js";
import { store } from "./store.js";
import { notifyRuntimeChanged } from "./runtime-events.js";
import { runCodexAgent } from "./codex-adapter.js";
import { EmissionEngineError, evaluateEmissionPolicies } from "./emission-engine.js";
import { operationDefinitionHash } from "./runtime-db.js";

const workerId = process.env.BALLET_AGENTD_WORKER_ID ?? `agentd-${process.pid}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findAgent = (data: AppData, role: string): Agent | undefined => data.agents.find((agent) => agent.id === role);
const findOperation = (data: AppData, run: AgentRun): AgentOperation | undefined =>
  run.operationId && run.operationVersion
    ? data.operations.find((operation) => operation.active && operation.id === run.operationId && operation.version === run.operationVersion)
    : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const buildRunPrompt = (operation: AgentOperation, input: JsonValue): string => {
  return [
    `You are executing the operation "${operation.name}".`,
    "",
    "Operation instructions:",
    operation.instructions,
    "",
    "Input:",
    JSON.stringify(input, null, 2),
    "",
    "Return only JSON matching the required output schema."
  ].join("\n");
};

const completeFailed = (run: AgentRun, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  store.runtimeDatabase().appendRunLog(run.runId, "error", message);
  store.runtimeDatabase().completeRun({
    runId: run.runId,
    status: "failed",
    error: message
  });
  notifyRuntimeChanged("agent-runs");
};

const runStatusFromOutput = (output: JsonValue): "completed" | "blocked" | "needs_input" | "failed" => {
  if (!isRecord(output) || typeof output.status !== "string") return "failed";
  if (["completed", "blocked", "needs_input", "failed"].includes(output.status)) {
    return output.status as "completed" | "blocked" | "needs_input" | "failed";
  }
  return "failed";
};

export const assertQueuedSnapshotMatches = (run: AgentRun, operation: AgentOperation, registry: ContractRegistry): void => {
  const currentOperationHash = operationDefinitionHash(operation);
  if (run.operationHash && run.operationHash !== currentOperationHash) {
    throw new Error(`Queued operation snapshot for ${operation.id}@${operation.version} no longer matches the current resource.`);
  }
  const inputContract = registry.require(operation.inputContract, "agent-input");
  const inputContractHash = contractSchemaHash(inputContract);
  if (run.inputContractHash && run.inputContractHash !== inputContractHash) {
    throw new Error(`Queued input contract snapshot for ${operation.inputContract.id}@${operation.inputContract.version} no longer matches the current schema.`);
  }
  const outputContract = registry.require(operation.outputContract, "agent-output");
  const outputContractHash = contractSchemaHash(outputContract);
  if (run.outputContractHash && run.outputContractHash !== outputContractHash) {
    throw new Error(`Queued output contract snapshot for ${operation.outputContract.id}@${operation.outputContract.version} no longer matches the current schema.`);
  }
};

export const emissionPoliciesForRun = (data: AppData, run: AgentRun) => {
  if (!run.loopDefinitionId || run.loopDefinitionVersion === undefined) return data.emissionPolicies;
  const loop = data.loopDefinitions.find((candidate) =>
    candidate.id === run.loopDefinitionId &&
    candidate.version === run.loopDefinitionVersion
  );
  if (!loop) return [];
  const included = data.emissionPolicies.filter((policy) => loop.emissionPolicyIds.includes(policy.id));
  for (const policyId of loop.emissionPolicyIds) {
    const activeVersions = included.filter((policy) => policy.id === policyId && policy.active);
    if (activeVersions.length > 1) {
      throw new Error(`Loop ${loop.id}@${loop.version} includes emission policy ${policyId}, but multiple active versions exist.`);
    }
  }
  return included;
};

const completeWithOutput = (
  run: AgentRun,
  trigger: RuntimeEvent,
  operation: AgentOperation,
  output: JsonValue,
  data: AppData,
  threadId?: string,
  turnId?: string
) => {
  const registry = new ContractRegistry(data.contracts);
  const outputValidation = registry.validate(operation.outputContract, output, "agent-output");
  if (!outputValidation.valid) {
    const message = `Agent output failed contract ${outputValidation.contractId}@${outputValidation.contractVersion} validation.`;
    store.runtimeDatabase().completeRun({
      runId: run.runId,
      status: "failed",
      output,
      outputContractId: outputValidation.contractId,
      outputContractVersion: outputValidation.contractVersion,
      outputContractHash: outputValidation.contractHash,
      outputValidationErrors: outputValidation.errors as unknown as Record<string, unknown>[],
      error: message,
      threadId,
      turnId
    });
    store.runtimeDatabase().appendRunLog(run.runId, "error", message, { errors: outputValidation.errors });
    notifyRuntimeChanged("agent-runs");
    return;
  }

  let emissions;
  try {
    emissions = evaluateEmissionPolicies({
      projectRoot: store.root,
      operation,
      run,
      trigger,
      input: run.inputJson ?? {},
      output,
      policies: emissionPoliciesForRun(data, run),
      eventDefinitions: data.eventDefinitions,
      contracts: registry
    });
  } catch (error) {
    const decisions = error instanceof EmissionEngineError ? error.decisions : [];
    const message = error instanceof Error ? error.message : String(error);
    store.runtimeDatabase().completeRun({
      runId: run.runId,
      status: "failed",
      output,
      outputContractId: outputValidation.contractId,
      outputContractVersion: outputValidation.contractVersion,
      outputContractHash: outputValidation.contractHash,
      emissionDecisions: decisions as unknown as Record<string, unknown>[],
      error: message,
      threadId,
      turnId
    });
    store.runtimeDatabase().appendRunLog(run.runId, "error", message);
    notifyRuntimeChanged("agent-runs");
    return;
  }

  const status = runStatusFromOutput(output);
  const result = store.runtimeDatabase().completeRun({
    runId: run.runId,
    status,
    output,
    outputContractId: outputValidation.contractId,
    outputContractVersion: outputValidation.contractVersion,
    outputContractHash: outputValidation.contractHash,
    emissionDecisions: emissions.decisions as unknown as Record<string, unknown>[],
    threadId,
    turnId,
    domainEvents: emissions.events,
    definitions: store.runtimeDefinitions(data)
  });

  if (threadId) {
    store.runtimeDatabase().upsertThreadBinding(trigger.subject, run.agentRole, threadId, operation.id, operation.version);
  }
  store.runtimeDatabase().appendRunLog(run.runId, "info", `Run completed with operation status ${status}.`, {
    emitted_events: emissions.events.map((event) => event.type),
    last_domain_event_type: result.event?.type
  });
  notifyRuntimeChanged("agent-runs");
  if (result.event) notifyRuntimeChanged("events");
};

export const runAgentWorkerOnce = async (): Promise<boolean> => {
  const runtime = store.runtimeDatabase();
  const run = runtime.leaseNextRun({ owner: workerId, leaseSeconds: 30 * 60 });
  if (!run) return false;
  notifyRuntimeChanged("agent-runs");
  runtime.appendRunLog(run.runId, "info", "Run leased by agentd.", { worker_id: workerId });

  try {
    const data = await store.read();
    const operation = findOperation(data, run);
    if (!operation) throw new Error(`Operation ${run.operationId ?? "unknown"}@${run.operationVersion ?? "unknown"} was not found.`);
    const agent = findAgent(data, operation.agentId);
    if (!agent) throw new Error(`Agent ${operation.agentId} was not found in .codex/agents.`);
    if (!agent.enabled) throw new Error(`Agent role ${run.agentRole} is disabled.`);
    const trigger = runtime.getTriggerEvent(run);
    if (!trigger) throw new Error(`Trigger event ${run.triggerEventId} was not found.`);
    const registry = new ContractRegistry(data.contracts);
    assertQueuedSnapshotMatches(run, operation, registry);
    const outputContract = registry.require(operation.outputContract, "agent-output");
    if (run.inputJson === undefined) throw new Error(`Run ${run.runId} does not have persisted operation input.`);
    const resumeThreadId = runtime.getThreadBinding(trigger.subject, run.agentRole, operation.id, operation.version) ?? run.threadId;
    const prompt = buildRunPrompt(operation, run.inputJson);

    const result = await runCodexAgent({
      runId: run.runId,
      workItemId: trigger.subject,
      agentRole: run.agentRole,
      operationId: operation.id,
      operationVersion: operation.version,
      agent,
      prompt,
      outputSchema: outputContract.schema,
      projectRoot: store.root,
      resumeThreadId,
      timeoutMs: Number(process.env.BALLET_AGENTD_CODEX_TIMEOUT_MS ?? 30 * 60 * 1000),
      onThread: (threadId, turnId) => {
        runtime.saveRunThread(run.runId, threadId, turnId);
        notifyRuntimeChanged("agent-runs");
      },
      onLog: (level, message, details) => runtime.appendRunLog(run.runId, level, message, details)
    });

    completeWithOutput(run, trigger, operation, result.output, data, result.threadId, result.turnId);
  } catch (error) {
    if (error instanceof ContractRegistryError) {
      runtime.appendRunLog(run.runId, "error", error.message, { details: error.details });
      runtime.completeRun({ runId: run.runId, status: "failed", error: error.message });
      notifyRuntimeChanged("agent-runs");
      return true;
    }
    completeFailed(run, error);
  }

  return true;
};

export const runAgentDaemon = async (): Promise<void> => {
  const pollMs = Number(process.env.BALLET_AGENTD_POLL_MS ?? 2000);
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });

  console.log(`Ballet agentd running as ${workerId}`);
  while (!stopping) {
    const worked = await runAgentWorkerOnce();
    if (!worked) await sleep(pollMs);
  }
  console.log("Ballet agentd stopped.");
};

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runAgentDaemon().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
