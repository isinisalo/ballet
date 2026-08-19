import type { JsonValue, ProjectLoop, ProjectLoopEdge } from "../../shared/domain/automation.js";
import type {
  LoopRunDetails, NodeRun, OrchestratorNodeOutcome, ValidationNodeOutcome, WorkNodeOutcome
} from "../../shared/domain/runtime.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { testLoop, testOrchestrator, testWorkLoopNode } from "../tests/v11TestConfig.js";
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
  const caller = testLoop("caller-loop", testWorkLoopNode("caller-work"));
  const targets = options.targets ?? [
    testLoop("repair-a", testWorkLoopNode("repair-a-work")),
    testLoop("repair-b", testWorkLoopNode("repair-b-work"))
  ];
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
  const work = activeNode(runtime);
  runtime.applyNodeOutcome("root-run", work.nodeRunId, workCompleted("Caller work completed."));
  const validation = activeNode(runtime);
  const repair = options.requestedOutcome
    ? { mode: "ORCHESTRATOR_REPAIR" as const, reason: "External repair is required.",
        requestedOutcome: options.requestedOutcome, evidenceRefs: ["check:caller"] }
    : { mode: "ORCHESTRATOR_REPAIR" as const, reason: "External repair is required.",
        requestedCapability: options.requestedCapability ?? "test:loop.transfer", evidenceRefs: ["check:caller"] };
  runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
    role: "validation", state: "completed", decision: "FAIL",
    summary: options.summary ?? "Caller validation found a repairable problem.",
    evidence: { finding: "caller" }, checks: [], repair
  });
  const orchestrator = activeNode(runtime);
  const requestId = runtime.connection().prepare(`
    SELECT repair_request_id FROM repair_requests WHERE orchestrator_node_run_id = ?
  `).pluck().get(orchestrator.nodeRunId);
  if (typeof requestId !== "string") throw new Error("Test Repair Request was not created.");
  return { work, validation, orchestrator, request: runtime.getRepairRequest(requestId)! };
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
    repairInput: { instruction: "Repair the caller finding." },
    expectedOutcome: { repaired: true }, ...overrides
  });
  const run = runtime.listRootLoopRuns("root-run").at(-1);
  if (!run) throw new Error("Test target Loop Run was not created.");
  return run;
};

export const completeActiveLoop = (
  runtime: RuntimeDatabase,
  options: { patch?: WorkNodeOutcome & { state: "completed" }; validation?: ValidationNodeOutcome } = {}
): LoopRunDetails => {
  const work = activeNode(runtime);
  runtime.applyNodeOutcome("root-run", work.nodeRunId, options.patch ?? workCompleted("Repair work completed."));
  const validation = activeNode(runtime);
  return runtime.applyNodeOutcome("root-run", validation.nodeRunId, options.validation ?? validationOk());
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

export const workCompleted = (summary: string): WorkNodeOutcome => ({
  role: "work", state: "completed", summary, artifacts: {}, checks: []
});

export const validationOk = (summary = "Validation accepted the result."): ValidationNodeOutcome => ({
  role: "validation", state: "completed", decision: "OK", summary, evidence: {}, checks: []
});
