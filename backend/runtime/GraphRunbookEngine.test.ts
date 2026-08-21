import { describe, expect, it } from "vitest";
import type {
  ProjectGraphTransition, ProjectLoop
} from "../../shared/domain/automation.js";
import type { NodeRun, ValidationNodeOutcome } from "../../shared/domain/runtime.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import {
  testJobPair, testLoop, testRunbookOrchestrator
} from "../tests/v13TestConfig.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

const loopIds = ["design", "plan", "build", "deploy", "verify"] as const;

const transitions: ProjectGraphTransition[] = [
  transition("design-success", "design", "PASS", "success", "plan"),
  transition("design-failure", "design", "FAIL", "failure", "design"),
  transition("plan-success", "plan", "PASS", "success", "build"),
  transition("plan-failure", "plan", "FAIL", "failure", "design"),
  transition("build-more-work", "build", "PASS", "more_work", "build"),
  transition("build-success", "build", "PASS", "success", "deploy"),
  transition("build-implementation-defect", "build", "FAIL", "implementation_defect", "build"),
  transition("build-invalid-plan", "build", "FAIL", "invalid_plan", "plan"),
  transition("build-invalid-design", "build", "FAIL", "invalid_design", "design"),
  transition("deploy-success", "deploy", "PASS", "success", "verify"),
  transition("deploy-transient", "deploy", "FAIL", "transient_deployment_error", "deploy"),
  transition("deploy-implementation-defect", "deploy", "FAIL", "implementation_defect", "build"),
  transition("deploy-invalid-plan", "deploy", "FAIL", "invalid_plan", "plan"),
  transition("verify-more-work", "verify", "PASS", "more_work", "plan"),
  transition("verify-complete", "verify", "PASS", "complete", "DONE"),
  transition("verify-implementation-defect", "verify", "FAIL", "implementation_defect", "build"),
  transition("verify-invalid-plan", "verify", "FAIL", "invalid_plan", "plan"),
  transition("verify-invalid-design", "verify", "FAIL", "invalid_design", "design")
];

describe("GraphRunbookEngine", () => {
  it.each(transitions)("routes $id by its exact immutable decision and outcome", async (route) => {
    const harness = await graphHarness(route.source);
    const runtime = new RuntimeDatabase(harness.filename);
    runtime.startLoopRun("root-run");
    completeJob(runtime);
    runtime.applyNodeOutcome("root-run", activeNode(runtime).nodeRunId, validationOutcome(route));

    const runs = runtime.listRootLoopRuns("root-run");
    if ("runResult" in route.target) {
      expect(runs).toHaveLength(1);
      expect(new RootRunStore(() => runtime.connection()).require("root-run")).toMatchObject({
        status: "running",
        activeLoopRunId: undefined,
        outcome: { role: "validation", decision: route.decision, transitionOutcome: route.outcome }
      });
      expect(runtime.connection().prepare(
        "SELECT terminal_result FROM graph_run_states WHERE root_run_id = 'root-run'"
      ).pluck().get()).toBe("DONE");
    } else {
      expect(runs).toHaveLength(2);
      expect(runs[1]).toMatchObject({ loopId: route.target.loopId, source: "transition" });
    }
    expect(runtime.listControlFlowEvents("root-run").at(-1)).toMatchObject({ kind: "graph_transition" });
    expect(runtime.connection().prepare(
      "SELECT last_transition_id FROM graph_run_states WHERE root_run_id = 'root-run'"
    ).pluck().get()).toBe(route.id);
    runtime.close();
    await harness.close();
  });

  it("routes from the persisted snapshot even when the checkout-side object changes", async () => {
    const route = transitions.find(({ id }) => id === "design-success")!;
    const harness = await graphHarness("design");
    harness.snapshot.graph.transitions.find(({ id }) => id === route.id)!.target = { loopId: "verify" };
    const runtime = new RuntimeDatabase(harness.filename);
    runtime.startLoopRun("root-run");
    completeJob(runtime);
    runtime.applyNodeOutcome("root-run", activeNode(runtime).nodeRunId, validationOutcome(route));
    expect(runtime.listRootLoopRuns("root-run").at(-1)).toMatchObject({ loopId: "plan" });
    runtime.close();
    await harness.close();
  });

  it("requires a named outcome for a terminal Validation in a Graph Run", async () => {
    const harness = await graphHarness("design");
    const runtime = new RuntimeDatabase(harness.filename);
    runtime.startLoopRun("root-run");
    completeJob(runtime);
    expect(() => runtime.applyNodeOutcome("root-run", activeNode(runtime).nodeRunId, {
      role: "validation", state: "completed", decision: "PASS",
      summary: "Missing graph outcome.", evidence: {}, checks: []
    })).toThrow(/must select a PASS transition outcome/i);
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });

  it("stops before transition 257 using the immutable RunBook limit", async () => {
    const self = transition("build-more-work", "build", "PASS", "more_work", "build");
    const done = transition("build-complete", "build", "PASS", "complete", "DONE");
    const harness = await createRuntimeStoreFixture({}, {
      rootKind: "graph",
      loop: graphLoop("build"),
      transitions: [self, done],
      repairEdges: [],
      orchestrator: { ...testRunbookOrchestrator(), maxTransitions: 256 }
    });
    harness.release();
    const runtime = new RuntimeDatabase(harness.filename);
    runtime.startLoopRun("root-run");
    for (let index = 0; index < 256; index += 1) {
      completeJob(runtime);
      runtime.applyNodeOutcome("root-run", activeNode(runtime).nodeRunId, validationOutcome(self));
    }
    completeJob(runtime);
    expect(() => runtime.applyNodeOutcome(
      "root-run", activeNode(runtime).nodeRunId, validationOutcome(done)
    )).toThrow(/exceeded its 256 transition limit/i);
    expect(runtime.connection().prepare(
      "SELECT COUNT(*) FROM control_flow_events WHERE root_run_id = 'root-run' AND kind = 'graph_transition'"
    ).pluck().get()).toBe(256);
    runtime.close();
    await harness.close();
  });

  it.each(["manual", "schedule"] as const)(
    "keeps an isolated %s Loop Root Run outside Graph transitions",
    async (source) => {
      const pair = source === "schedule" ? testJobPair("design-job", {
        scheduled: { kind: "once", date: "2026-01-01", time: "00:00", timeZone: "UTC" },
        maxRetries: 0
      }) : testJobPair("design-job", { maxRetries: 0 });
      const harness = await createRuntimeStoreFixture({}, {
        rootKind: "loop",
        loop: testLoop("design", pair),
        transitions: [],
        repairEdges: [],
        orchestrator: testRunbookOrchestrator()
      });
      harness.release();
      const runtime = new RuntimeDatabase(harness.filename);
      runtime.startLoopRun("root-run", undefined, source, source === "schedule" ? {
        jobNodeId: "design-job", scheduledFor: "2026-01-01T00:00:00.000Z"
      } : undefined);
      completeJob(runtime);
      runtime.applyNodeOutcome("root-run", activeNode(runtime).nodeRunId, {
        role: "validation", state: "completed", decision: "PASS",
        summary: "Isolated Loop completed.", evidence: {}, checks: []
      });
      expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
      expect(runtime.listControlFlowEvents("root-run").filter(({ kind }) => kind === "graph_transition"))
        .toEqual([]);
      expect(new RootRunStore(() => runtime.connection()).require("root-run")).toMatchObject({
        status: "running",
        activeLoopRunId: undefined
      });
      runtime.close();
      await harness.close();
    }
  );
});

const graphHarness = async (startLoopId: string) => {
  const loops = loopIds.map(graphLoop);
  const start = loops.find(({ id }) => id === startLoopId)!;
  const harness = await createRuntimeStoreFixture({}, {
    rootKind: "graph",
    loop: start,
    loops,
    transitions,
    repairEdges: [],
    orchestrator: testRunbookOrchestrator()
  });
  harness.release();
  return harness;
};

const graphLoop = (id: string): ProjectLoop => testLoop(id, testJobPair(`${id}-job`, { maxRetries: 0 }));

function transition(
  id: string,
  source: string,
  decision: "PASS" | "FAIL",
  outcome: string,
  target: string
): ProjectGraphTransition {
  return {
    id,
    source,
    decision,
    outcome,
    target: target === "DONE" ? { runResult: "DONE" } : { loopId: target },
    description: `${source} ${decision} ${outcome}.`
  };
}

const activeNode = (runtime: RuntimeDatabase): NodeRun => {
  const id = runtime.connection().prepare(
    "SELECT active_node_run_id FROM root_runs WHERE root_run_id = 'root-run'"
  ).pluck().get();
  if (typeof id !== "string") throw new Error("Test Root Run has no active Node Run.");
  const node = runtime.getNodeRun(id);
  if (!node) throw new Error(`Test active Node Run ${id} was not found.`);
  return node;
};

const completeJob = (runtime: RuntimeDatabase): void => {
  const job = activeNode(runtime);
  expect(job.role).toBe("job");
  runtime.applyNodeOutcome("root-run", job.nodeRunId, {
    role: "job", state: "completed", summary: "Job completed.", artifacts: {}, checks: []
  });
};

const validationOutcome = (route: ProjectGraphTransition): ValidationNodeOutcome => route.decision === "PASS"
  ? {
      role: "validation", state: "completed", decision: "PASS",
      transitionOutcome: route.outcome, summary: "Validation passed.", evidence: {}, checks: []
    }
  : {
      role: "validation", state: "completed", decision: "FAIL",
      transitionOutcome: route.outcome, summary: "Validation selected a failure route.",
      feedback: "The RunBook needs a correction.", expectedCorrection: "Follow the named route.",
      evidence: {}, checks: []
    };
