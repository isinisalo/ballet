import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { testWorkLoopNode } from "../tests/v10TestConfig.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

describe("scheduled Root Run", () => {
  it("initializes revision 0 identically for a scheduled root occurrence", async () => {
    const node = testWorkLoopNode("scheduled-work", { scheduled: {
      kind: "once", date: "2026-08-16", time: "09:00", timeZone: "Europe/Helsinki"
    } });
    const fixture = await createRuntimeStoreFixture({ occurrence: null }, { loop: {
      id: "scheduled-loop", description: "Scheduled Loop.",
      state: { description: "Scheduled State.", initial: { occurrence: null } },
      startNodeId: node.id, nodes: [node],
      edges: [{ id: "scheduled-done", source: node.id, target: { terminal: "completed" } }]
    } });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const run = runtime.startLoopRun("root-run", undefined, "schedule", {
      workLoopNodeId: node.id, scheduledFor: "2026-08-16T06:00:00.000Z"
    });

    expect(run).toMatchObject({ source: "schedule", schedule: {
      workLoopNodeId: node.id, scheduledFor: "2026-08-16T06:00:00.000Z"
    }, entryStateRevision: 0 });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { occurrence: null } });
    expect(run.nodeRuns[0]).toMatchObject({ role: "work", workLoopNodeId: node.id, stateRevisionBefore: 0 });
    runtime.close();
    await fixture.close();
  });
});
