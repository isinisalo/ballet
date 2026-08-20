import type { JsonValue, ProjectLoop, ProjectLoopEdge } from "../../shared/domain/automation.js";
import type {
  LoopRunDetails, NodeRun, OrchestratorNodeOutcome, ValidationNodeOutcome, JobNodeOutcome
} from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { testJobPair, testLoop, testOrchestrator } from "../tests/v12TestConfig.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

export interface OrchestrationHarness {
  runtime: RuntimeDatabase;
  filename: string;
  caller: ProjectLoop;
  targets: ProjectLoop[];
  close(): Promise<void>;
}

export const createOrchestrationHarness = async (options: {
  initial?: Record<string, boolean | number | string>;
  targets?: ProjectLoop[];
  edges?: ProjectLoopEdge[];
  maxRepairDepth?: number;
  maxRepairAttempts?: number;
} = {}): Promise<OrchestrationHarness> => {
  const callerPair = testJobPair("caller-job", { maxRetries: 0 });
  const caller = testLoop("caller-loop", callerPair);
  const targetSource = options.targets ?? [
    testLoop("repair-a", testJobPair("repair-a-job", { maxRetries: 0 })),
    testLoop("repair-b", testJobPair("repair-b-job", { maxRetries: 0 }))
  ];
  const targets = targetSource.map((loop) => ({
    ...loop,
    workflow: { ...loop.workflow, jobNodes: loop.workflow.jobNodes.map((job) => ({ ...job, maxRetries: 0 })) }
  }));
  const edges = options.edges ?? targets.map((target, index) => ({
    id: `repair-edge-${index + 1}`, source: caller.id, target: target.id,
    kind: "repair" as const, capability: "test:loop.transfer", description: `Allow ${target.id}.`
  }));
  const fixture = await createRuntimeStoreFixture(options.initial ?? { repaired: false }, {
    loop: caller, loops: targets, loopEdges: edges,
    orchestrator: {
      ...testOrchestrator(),
      maxRepairDepth: options.maxRepairDepth ?? testOrchestrator().maxRepairDepth,
      maxRepairAttempts: options.maxRepairAttempts ?? testOrchestrator().maxRepairAttempts
    }
  });
  fixture.release();
  const runtime = new RuntimeDatabase(fixture.filename);
  return { runtime, filename: fixture.filename, caller, targets, close: () => fixture.close() };
};

export const requestExternalRepair = (
  runtime: RuntimeDatabase,
  options: {
    requestedCapability?: string;
    requestedOutcome?: JsonValue;
    summary?: string;
  } = {}
) => {
  const job = activeNode(runtime);
  runtime.applyNodeOutcome("root-run", job.nodeRunId, jobCompleted("Caller Job completed."));
  const validation = activeNode(runtime);
  const escalation = options.requestedOutcome
    ? { reason: "External repair is required.",
        requestedOutcome: options.requestedOutcome, evidenceRefs: ["check:caller"] }
    : { reason: "External repair is required.",
        requestedCapability: options.requestedCapability ?? "test:loop.transfer", evidenceRefs: ["check:caller"] };
  runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
    role: "validation", state: "completed", decision: "FAIL",
    summary: options.summary ?? "Caller validation found a repairable problem.",
    evidence: { finding: "caller" }, checks: [],
    feedback: "Repair the caller finding.", expectedCorrection: "Make the caller Validation pass.", escalation
  });
  const orchestrator = activeNode(runtime);
  const requestId = runtime.connection().prepare(`
    SELECT repair_request_id FROM repair_requests WHERE orchestrator_node_run_id = ?
  `).pluck().get(orchestrator.nodeRunId);
  if (typeof requestId !== "string") throw new Error("Test Repair Request was not created.");
  const orchestrationRequest = runtime.orchestration.forOrchestrator(orchestrator.nodeRunId);
  if (!orchestrationRequest) throw new Error("Test Orchestration Request was not created.");
  return {
    job, validation, orchestrator,
    request: runtime.getRepairRequest(requestId)!, orchestrationRequest
  };
};

export const routeRepair = (
  runtime: RuntimeDatabase,
  orchestrator: NodeRun,
  targetLoopId: string,
  overrides: Partial<Extract<OrchestratorNodeOutcome, { state: "completed" }>> = {}
): LoopRunDetails => {
  runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
    role: "orchestrator", state: "completed", targetLoopId,
    routeReason: "The target matches the requested capability.",
    dispatchInput: { instruction: "Repair the caller finding." },
    expectedOutcome: { repaired: true }, ...overrides
  });
  const run = runtime.listRootLoopRuns("root-run").at(-1);
  if (!run) throw new Error("Test target Loop Run was not created.");
  return run;
};

export const completeActiveLoop = (
  runtime: RuntimeDatabase,
  options: { patch?: JobNodeOutcome & { state: "completed" }; validation?: ValidationNodeOutcome } = {}
): LoopRunDetails => {
  const job = activeNode(runtime);
  runtime.applyNodeOutcome("root-run", job.nodeRunId, options.patch ?? jobCompleted("Repair Job completed."));
  const validation = activeNode(runtime);
  return runtime.applyNodeOutcome("root-run", validation.nodeRunId, options.validation ?? validationPass());
};

export const activeNode = (runtime: RuntimeDatabase): NodeRun => {
  const id = runtime.connection().prepare(`
    SELECT active_node_run_id FROM root_runs WHERE root_run_id = 'root-run'
  `).pluck().get();
  if (typeof id !== "string") throw new Error("Test Root Run has no active Node Run.");
  const node = runtime.getNodeRun(id);
  if (!node) throw new Error(`Test active Node Run ${id} was not found.`);
  return node;
};

export const jobCompleted = (summary: string): JobNodeOutcome => ({
  role: "job", state: "completed", summary, artifacts: {}, checks: []
});

export const validationPass = (summary = "Validation accepted the result."): ValidationNodeOutcome => ({
  role: "validation", state: "completed", decision: "PASS", summary, evidence: {}, checks: []
});
