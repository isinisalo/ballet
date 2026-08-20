import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

describe("RootRuntimeReadStore", () => {
  it("reconstructs current State and bounded revision evidence after reopen", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const runtimeIds = createComposite(fixture);
    const node = createJobNode(fixture, runtimeIds, "job-1", 1);
    fixture.states.commitNodeOutcome({
      rootRunId: "root-run",
      nodeRunId: node.nodeRunId,
      baseRevision: 0,
      outcome: {
        role: "job",
        state: "completed",
        summary: "Incremented state.",
        artifacts: {},
        checks: [],
        statePatch: [{ op: "replace", path: "/count", value: 1 }]
      },
      control: { kind: "job_completed" }
    });
    fixture.release();

    const reopened = new RuntimeDatabase(fixture.filename);
    const projection = reopened.readRootRuntime("root-run");
    expect(projection.state).toMatchObject({
      currentRevision: 1,
      currentState: { count: 1 },
      totalRevisionCount: 2,
      historyTruncated: false,
      revisions: [
        { revision: 0, patchOmitted: false },
        { revision: 1, parentRevision: 0, sourceNodeRunId: "job-1", patchOmitted: false }
      ]
    });
    expect(projection.state.revisions[1]?.patch?.patch).toEqual([
      { op: "replace", path: "/count", value: 1 }
    ]);
    expect(projection.state.revisions[1]).not.toHaveProperty("outcome");
    expect(projection.controlFlowEvents).toEqual([
      expect.objectContaining({ sequence: 1, kind: "job_completed", stateRevision: 1 })
    ]);
    reopened.close();
    await fixture.close();
  });

  it("keeps revision history and patch evidence within deterministic read limits", async () => {
    const fixture = await createRuntimeStoreFixture({ value: "", count: 0 });
    const runtimeIds = createComposite(fixture);
    for (let revision = 1; revision <= 6; revision += 1) {
      const node = createJobNode(fixture, runtimeIds, `large-${revision}`, revision);
      fixture.states.commitNodeOutcome({
        rootRunId: "root-run",
        nodeRunId: node.nodeRunId,
        baseRevision: revision - 1,
        outcome: {
          role: "job", state: "completed", summary: `Large patch ${revision}.`, artifacts: {}, checks: [],
          statePatch: [{ op: "replace", path: "/value", value: String(revision).repeat(60_000) }]
        },
        control: { kind: "job_completed" }
      });
    }
    for (let revision = 7; revision <= 65; revision += 1) {
      const node = createJobNode(fixture, runtimeIds, `small-${revision}`, revision);
      fixture.states.commitNodeOutcome({
        rootRunId: "root-run",
        nodeRunId: node.nodeRunId,
        baseRevision: revision - 1,
        outcome: {
          role: "job", state: "completed", summary: `Small patch ${revision}.`, artifacts: {}, checks: [],
          statePatch: [{ op: "replace", path: "/count", value: revision }]
        },
        control: { kind: "job_completed" }
      });
    }
    fixture.release();

    const reopened = new RuntimeDatabase(fixture.filename);
    const { state } = reopened.readRootRuntime("root-run");
    expect(state).toMatchObject({
      currentRevision: 65,
      totalRevisionCount: 66,
      historyTruncated: true
    });
    expect(state.revisions).toHaveLength(64);
    expect(state.revisions[0]?.revision).toBe(2);
    expect(state.revisions.at(-1)?.revision).toBe(65);
    expect(state.revisions.filter(({ patchOmitted }) => patchOmitted)).toHaveLength(1);
    expect(state.revisions.find(({ revision }) => revision === 2)?.patchOmitted).toBe(true);
    reopened.close();
    await fixture.close();
  });
});

type Fixture = Awaited<ReturnType<typeof createRuntimeStoreFixture>>;

const createComposite = (fixture: Fixture) => {
  const loop = fixture.loops.createLoopRun({
    loopRunId: "loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
  });
  const job = fixture.loops.createJobRun({
    jobRunId: "job-run", rootRunId: "root-run", loopRunId: loop.loopRunId,
    loopId: fixture.loop.id, jobNodeId: fixture.loop.workflow.startJobNodeId, jobAttempt: 1
  });
  return { loopRunId: loop.loopRunId, jobRunId: job.jobRunId };
};

const createJobNode = (
  fixture: Fixture,
  ids: ReturnType<typeof createComposite>,
  nodeRunId: string,
  attempt: number
) => fixture.loops.createNodeRun({
  nodeRunId, rootRunId: "root-run", loopRunId: ids.loopRunId,
  jobRunId: ids.jobRunId, role: "job", loopId: fixture.loop.id,
  jobNodeId: fixture.loop.workflow.startJobNodeId, workflowNodeId: fixture.loop.workflow.startJobNodeId,
  nodeDefinitionId: "main-loop:job:job", attempt
});
