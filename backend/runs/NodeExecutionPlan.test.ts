import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { createRuntimeStoreFixture } from "../runtime/RuntimeStore.test-fixture.js";
import { RootRunStore } from "./RootRunStore.js";
import { createNodeTaskEnvelope } from "./NodeExecutionPlan.js";

describe("Node Task Envelope runtime projection", () => {
  it("passes the committed Work outcome and latest State to Validation", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const run = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Committed Work.", artifacts: { report: "artifact:1" }, checks: [],
      statePatch: [{ op: "replace", path: "/count", value: 1 }]
    });
    const validation = run.nodeRuns.at(-1)!;
    const envelope = createNodeTaskEnvelope({
      root: new RootRunStore(() => runtime.connection()).require("root-run"),
      run,
      composite: run.workLoopNodeRuns[0]!,
      node: validation,
      state: runtime.state.current("root-run"),
      events: runtime.listControlFlowEvents("root-run")
    });

    expect(envelope).toMatchObject({
      role: "validation",
      state: { revision: 1, value: { count: 1 } },
      workOutcome: { role: "work", state: "completed", summary: "Committed Work." }
    });
    runtime.close();
    await fixture.close();
  });

  it("passes persisted local feedback to the retry Work attempt", async () => {
    const fixture = await createRuntimeStoreFixture({ corrected: false });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Initial Work.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;
    const run = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Retry.", evidence: {}, checks: [],
      repair: { mode: "LOCAL_RETRY", feedback: "Fix the value.", expectedCorrection: "Set corrected true." }
    });
    const retry = run.nodeRuns.at(-1)!;
    const envelope = createNodeTaskEnvelope({
      root: new RootRunStore(() => runtime.connection()).require("root-run"),
      run,
      composite: run.workLoopNodeRuns[0]!,
      node: retry,
      state: runtime.state.current("root-run"),
      events: runtime.listControlFlowEvents("root-run")
    });

    expect(envelope).toMatchObject({
      role: "work", localAttempt: 2,
      previousValidationFeedback: { feedback: "Fix the value.", expectedCorrection: "Set corrected true." }
    });
    runtime.close();
    await fixture.close();
  });
});
