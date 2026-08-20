import { describe, expect, it } from "vitest";
import { maxProjectStateBytes } from "../../shared/domain/automation.js";
import { maxRuntimeJsonDepth, maxStatePatchBytes } from "../../shared/domain/runtime.js";
import { canonicalJson, jsonSha256 } from "./state/CanonicalJson.js";
import {
  applyStatePatch, StatePatchValidationError, validateState, validateStatePatch
} from "./state/StatePatch.js";
import { createRuntimeStoreFixture, runtimeTestTimestamp } from "./RuntimeStore.test-fixture.js";

describe("LoopStateStore", () => {
  it("creates revision 0 from Root Loop initial state", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0, nested: { ready: false } });

    expect(fixture.states.list("root-run")).toEqual([expect.objectContaining({
      revision: 0,
      parentRevision: undefined,
      state: { count: 0, nested: { ready: false } },
      stateSha256: jsonSha256({ count: 0, nested: { ready: false } }),
      patch: undefined
    })]);
    await fixture.close();
  });

  it("commits patch, canonical outcome, revision, and control flow atomically", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0, items: [] });
    const { nodeRunId } = createActiveJobNode(fixture);
    const result = fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "job", state: "completed", summary: "Work finished.", artifacts: {}, checks: [],
        statePatch: [
          { op: "replace", path: "/count", value: 1 },
          { op: "add", path: "/items/-", value: "artifact" }
        ]
      },
      control: { kind: "job_completed" },
      committedAt: runtimeTestTimestamp
    });

    expect(result.revision).toMatchObject({
      revision: 1,
      parentRevision: 0,
      state: { count: 1, items: ["artifact"] },
      sourceNodeRunId: nodeRunId,
      outcome: { role: "job", state: "completed", summary: "Work finished." }
    });
    expect(result.revision.stateSha256).toBe(jsonSha256({ count: 1, items: ["artifact"] }));
    expect(fixture.roots.require("root-run")).toMatchObject({ stateRevision: 1, transitionCount: 1 });
    expect(fixture.loops.getNodeRun(nodeRunId)).toMatchObject({
      status: "completed", stateRevisionAfter: 1, patch: { patchSha256: expect.stringMatching(/^[0-9a-f]{64}$/) }
    });
    expect(fixture.control.listByRoot("root-run")).toEqual([expect.objectContaining({
      kind: "job_completed", stateRevision: 1, sourceNodeRunId: nodeRunId
    })]);
    await fixture.close();
  });

  it("rejects stale and invalid patches without changing state or Node Run", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const { nodeRunId } = createActiveJobNode(fixture);

    expect(() => fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 1,
      outcome: {
        role: "job", state: "completed", summary: "Invalid.", artifacts: {}, checks: [],
        statePatch: [{ op: "replace", path: "/missing", value: true }]
      },
      control: { kind: "job_completed" }
    })).toThrow(/stale/);

    expect(() => fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "job", state: "completed", summary: "Invalid.", artifacts: {}, checks: [],
        statePatch: [{ op: "replace", path: "/missing", value: true }]
      },
      control: { kind: "job_completed" }
    })).toThrow(/does not exist/);
    expect(fixture.states.list("root-run")).toHaveLength(1);
    expect(fixture.states.current("root-run").state).toEqual({ count: 0 });
    expect(fixture.loops.getNodeRun(nodeRunId)).toMatchObject({ status: "queued", outcome: undefined });
    expect(fixture.connection().prepare("SELECT COUNT(*) FROM control_flow_events").pluck().get()).toBe(0);
    await fixture.close();
  });

  it("rolls back outcome and revision when the control-flow write fails", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const { nodeRunId } = createActiveJobNode(fixture);
    fixture.connection().exec(`
      CREATE TRIGGER reject_test_control_event BEFORE INSERT ON control_flow_events
      BEGIN SELECT RAISE(ABORT, 'test control event failure'); END;
    `);

    expect(() => fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "job", state: "completed", summary: "Must roll back.", artifacts: {}, checks: [],
        statePatch: [{ op: "replace", path: "/count", value: 1 }]
      },
      control: { kind: "job_completed" }
    })).toThrow("test control event failure");

    expect(fixture.states.list("root-run")).toHaveLength(1);
    expect(fixture.roots.require("root-run")).toMatchObject({ stateRevision: 0, transitionCount: 0 });
    expect(fixture.loops.getNodeRun(nodeRunId)).toMatchObject({ status: "queued", outcome: undefined });
    await fixture.close();
  });

  it("recovers the last fully committed revision after reopen", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const { nodeRunId } = createActiveJobNode(fixture);
    fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "job", state: "completed", summary: "Committed.", artifacts: {}, checks: [],
        statePatch: [{ op: "replace", path: "/count", value: 1 }]
      },
      control: { kind: "job_completed" }
    });

    const reopened = fixture.reopen();
    expect(reopened.states.current("root-run")).toMatchObject({ revision: 1, state: { count: 1 } });
    expect(reopened.roots.require("root-run")).toMatchObject({ stateRevision: 1 });
    await fixture.close();
  });
});

describe("LoopStateStore outcome evidence", () => {
  it("validates and commits an OK Validation State patch through the same atomic persistence contract", async () => {
    const fixture = await createRuntimeStoreFixture({ validated: false });
    const { nodeRunId } = createActiveNode(fixture, "validation");
    const result = fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "validation", state: "completed", decision: "PASS", summary: "Validation passed.",
        evidence: { reference: "check:validation" }, checks: [],
        statePatch: [{ op: "replace", path: "/validated", value: true }]
      },
      control: { kind: "validation_pass" }
    });

    expect(result.revision).toMatchObject({ revision: 1, state: { validated: true } });
    expect(fixture.loops.getNodeRun(nodeRunId)).toMatchObject({
      role: "validation", stateRevisionAfter: 1,
      outcome: { role: "validation", state: "completed", decision: "PASS" }
    });
    await fixture.close();
  });

  it("rejects an oversized Validation State patch before any outcome or control-flow commit", async () => {
    const fixture = await createRuntimeStoreFixture({ validated: false });
    const { nodeRunId } = createActiveNode(fixture, "validation");
    expect(() => fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "validation", state: "completed", decision: "PASS", summary: "Invalid patch.",
        evidence: {}, checks: [],
        statePatch: [{ op: "add", path: "/large", value: "x".repeat(maxStatePatchBytes) }]
      },
      control: { kind: "validation_pass" }
    })).toThrow(/maximum is 65536 bytes/);
    expect(fixture.states.current("root-run")).toMatchObject({ revision: 0, state: { validated: false } });
    expect(fixture.loops.getNodeRun(nodeRunId)).toMatchObject({ status: "queued", outcome: undefined });
    expect(fixture.control.listByRoot("root-run")).toEqual([]);
    await fixture.close();
  });

  it("records an outcome and control event without creating a revision when there is no patch", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const { nodeRunId } = createActiveJobNode(fixture);
    const result = fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: { role: "job", state: "completed", summary: "No state change.", artifacts: {}, checks: [] },
      control: { kind: "job_completed" }, committedAt: runtimeTestTimestamp
    });

    expect(result.revision.revision).toBe(0);
    expect(fixture.states.list("root-run")).toHaveLength(1);
    expect(fixture.loops.getNodeRun(nodeRunId)).toMatchObject({
      status: "completed", stateRevisionAfter: 0,
      outcome: { role: "job", state: "completed", summary: "No state change." }
    });
    expect(fixture.roots.require("root-run")).toMatchObject({ stateRevision: 0, transitionCount: 1 });
    await fixture.close();
  });

  it("detects persisted State hash tampering on readback", async () => {
    const fixture = await createRuntimeStoreFixture({ trusted: true });
    fixture.connection().exec("DROP TRIGGER state_revision_is_immutable");
    fixture.connection().prepare(`
      UPDATE state_revisions SET state_json = '{"trusted":false}'
      WHERE root_run_id = 'root-run' AND revision = 0
    `).run();

    expect(() => fixture.states.current("root-run")).toThrow(/invalid hash evidence/);
    await fixture.close();
  });

  it("detects persisted patch hash tampering on readback", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const { nodeRunId } = createActiveJobNode(fixture);
    fixture.states.commitNodeOutcome({
      rootRunId: "root-run", nodeRunId, baseRevision: 0,
      outcome: {
        role: "job", state: "completed", summary: "Patched.", artifacts: {}, checks: [],
        statePatch: [{ op: "replace", path: "/count", value: 1 }]
      },
      control: { kind: "job_completed" }
    });
    fixture.connection().exec("DROP TRIGGER state_revision_is_immutable");
    fixture.connection().prepare(`
      UPDATE state_revisions SET patch_hash = ? WHERE root_run_id = 'root-run' AND revision = 1
    `).run("0".repeat(64));

    expect(() => fixture.states.current("root-run")).toThrow(/invalid patch hash evidence/);
    await fixture.close();
  });
});

describe("StatePatch", () => {
  it("uses deterministic canonical JSON and hashes independent of object key order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    expect(jsonSha256({ a: 1, b: 2 })).toBe(jsonSha256({ b: 2, a: 1 }));
  });

  it.each([
    [[{ op: "move", from: "/a", path: "/b" }], /unsupported op/],
    [[{ op: "replace", path: "", value: 1 }], /non-empty JSON Pointer/],
    [[{ op: "add", path: "/__proto__/polluted", value: true }], /forbidden segment/],
    [[{ op: "remove", path: "/array/-" }], /invalid array index/]
  ])("rejects invalid patch syntax %#", (patch, message) => {
    expect(() => applyStatePatch({ array: [1], a: true }, patch)).toThrow(message);
  });

  it("accepts exact byte, operation, and depth limits and rejects one over", () => {
    const emptyPatch = [{ op: "add", path: "/large", value: "" }];
    const patchOverhead = Buffer.byteLength(canonicalJson(emptyPatch), "utf8");
    const exactPatch = [{ op: "add", path: "/large", value: "x".repeat(maxStatePatchBytes - patchOverhead) }];
    expect(Buffer.byteLength(canonicalJson(exactPatch), "utf8")).toBe(maxStatePatchBytes);
    expect(validateStatePatch(exactPatch)).toHaveLength(1);
    expect(() => validateStatePatch([
      { op: "add", path: "/large", value: "x".repeat(maxStatePatchBytes - patchOverhead + 1) }
    ])).toThrow(/maximum is 65536 bytes/);

    const exactState = "x".repeat(maxProjectStateBytes - 2);
    expect(Buffer.byteLength(canonicalJson(exactState), "utf8")).toBe(maxProjectStateBytes);
    expect(validateState(exactState)).toBe(exactState);
    expect(() => validateState(`${exactState}x`)).toThrow(/maximum is 262144 bytes/);

    const exactOperations = Array.from({ length: 128 }, (_, index) => (
      { op: "add", path: `/value-${index}`, value: index }
    ));
    expect(applyStatePatch({}, exactOperations).state).toMatchObject({ "value-127": 127 });
    expect(() => validateStatePatch([...exactOperations, { op: "add", path: "/over", value: true }]))
      .toThrow(/maximum is 128/);

    const exactDepth = nestedValue(maxRuntimeJsonDepth);
    expect(validateState(exactDepth)).toEqual(exactDepth);
    expect(() => validateState(nestedValue(maxRuntimeJsonDepth + 1))).toThrow(/maximum JSON depth/);
  });

  it("does not mutate the input state when a later operation fails", () => {
    const state = { count: 0, nested: { ready: false } };
    expect(() => applyStatePatch(state, [
      { op: "replace", path: "/count", value: 1 },
      { op: "remove", path: "/missing" }
    ])).toThrow(StatePatchValidationError);
    expect(state).toEqual({ count: 0, nested: { ready: false } });
  });

  it("rejects child paths against a primitive State root", () => {
    expect(() => applyStatePatch(0, [{ op: "add", path: "/child", value: true }]))
      .toThrow(/has no object parent/);
  });
});

const nestedValue = (depth: number): unknown => {
  let value: unknown = null;
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
};

const createActiveJobNode = (fixture: Awaited<ReturnType<typeof createRuntimeStoreFixture>>) => {
  return createActiveNode(fixture, "job");
};

const createActiveNode = (
  fixture: Awaited<ReturnType<typeof createRuntimeStoreFixture>>,
  role: "job" | "validation"
) => {
  const loop = fixture.loops.createLoopRun({
    loopRunId: "loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
  });
  const job = fixture.loops.createJobRun({
    jobRunId: "job-run", rootRunId: "root-run", loopRunId: loop.loopRunId,
    loopId: fixture.loop.id, jobNodeId: fixture.loop.workflow.startJobNodeId, jobAttempt: 1
  });
  return fixture.loops.createNodeRun({
    nodeRunId: `${role}-node-run`, rootRunId: "root-run", loopRunId: loop.loopRunId,
    jobRunId: job.jobRunId, role, loopId: fixture.loop.id,
    jobNodeId: fixture.loop.workflow.startJobNodeId,
    workflowNodeId: role === "job" ? fixture.loop.workflow.startJobNodeId : fixture.loop.workflow.jobNodes[0]!.validationNodeId,
    nodeDefinitionId: role === "job" ? "main-loop:job:job" : "main-loop:job-validation:validation", attempt: 1
  });
};
