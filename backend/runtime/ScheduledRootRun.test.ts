import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { testJobPair } from "../tests/v13TestConfig.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

describe("scheduled Root Run", () => {
  it("initializes revision 0 identically for a scheduled root occurrence", async () => {
    const pair = testJobPair("scheduled-job", { scheduled: {
      kind: "once", date: "2026-08-16", time: "09:00", timeZone: "Europe/Helsinki"
    } });
    const fixture = await createRuntimeStoreFixture({ occurrence: null }, { loop: {
      id: "scheduled-loop", description: "Scheduled Loop.",
      capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
      state: { description: "Scheduled State.", initial: { occurrence: null } },
      workflow: {
        startJobNodeId: pair.job.id, jobNodes: [pair.job], validationNodes: [pair.validation],
        passEdges: [{ id: "scheduled-pass", sourceValidationNodeId: pair.validation.id, target: { workflowResult: "PASS" } }],
        failEdges: [{ id: "scheduled-fail", sourceValidationNodeId: pair.validation.id, target: { workflowResult: "FAIL" } }]
      }
    } });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const run = runtime.startLoopRun("root-run", undefined, "schedule", {
      jobNodeId: pair.job.id, scheduledFor: "2026-08-16T06:00:00.000Z"
    });

    expect(run).toMatchObject({ source: "schedule", schedule: {
      jobNodeId: pair.job.id, scheduledFor: "2026-08-16T06:00:00.000Z"
    }, entryStateRevision: 0 });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { occurrence: null } });
    expect(run.nodeRuns[0]).toMatchObject({ role: "job", jobNodeId: pair.job.id, stateRevisionBefore: 0 });
    runtime.close();
    await fixture.close();
  });
});
