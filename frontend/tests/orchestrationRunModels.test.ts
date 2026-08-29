import { describe, expect, it } from "vitest";
import {
  continuationLineage,
  criticDecisionRequest,
  currentGate,
  diffPresentation,
  orderedRunProjection,
  reconcileRows,
  refinementDecisionRequest,
  retrySummary,
  statusPresentation,
  timelineForAction
} from "../src/orchestration/runModels";
import type { RunDetail, RunSummary, StateProjection } from "../src/orchestration/runTypes";

const states = (): StateProjection[] => [
  { stateExecutionId: "sx-2", stateDefinitionId: "state-2", order: 2, status: "pending", revision: 0, createdAt: "now", updatedAt: "now", done: false, blocked: false, actions: [{ actionExecutionId: "ax-2", actionDefinitionId: "action-2", priority: 2, status: "pending", revision: 0, workAttempt: 0, maxRetries: 1, createdAt: "now", updatedAt: "now", done: false, blocked: false }] },
  { stateExecutionId: "sx-1", stateDefinitionId: "state-1", order: 1, status: "running", revision: 1, createdAt: "now", updatedAt: "now", done: false, blocked: false, actions: [
    { actionExecutionId: "ax-1b", actionDefinitionId: "action-1b", priority: 2, status: "pending", revision: 0, workAttempt: 0, maxRetries: 2, createdAt: "now", updatedAt: "now", done: false, blocked: false },
    { actionExecutionId: "ax-1a", actionDefinitionId: "action-1a", priority: 1, status: "prechecking", revision: 1, workAttempt: 0, maxRetries: 2, createdAt: "now", updatedAt: "now", done: false, blocked: false }
  ] }
];

const run = (): RunDetail => ({ environmentRunId: "run-1", environmentDefinitionId: "environment-1", source: "manual", status: "running", revision: 1, baseCommit: "abc", branch: "ballet/run-1", transitionCount: 1, transitionLimit: 10, createdAt: "now", updatedAt: "now", states: states(), events: [] });

describe("orchestration Run and governance models", () => {
  it("orders States by order and Actions by priority", () => { const ordered = orderedRunProjection(states()); expect(ordered.map((item) => item.order)).toEqual([1, 2]); expect(ordered[0]?.actions.map((item) => item.priority)).toEqual([1, 2]); });
  it("selects the first unfinished State and Action as the current gate", () => expect(currentGate(run())).toMatchObject({ state: { stateDefinitionId: "state-1" }, action: { actionDefinitionId: "action-1a" } }));
  it("keeps a blocked Run label explicit", () => expect(currentGate({ ...run(), status: "blocked" }).label).toBe("Blocked"));
  it("interprets maxRetries as additional Work attempts", () => expect(retrySummary({ workAttempt: 2, maxRetries: 2 })).toEqual({ attempt: 2, total: 3, retriesUsed: 1, retriesRemaining: 1 }));
  it("groups and orders Validation and subordinate Work events", () => expect(timelineForAction([
    { actionExecutionId: "ax-1a", sequence: 2, kind: "work_started", createdAt: "later" },
    { actionExecutionId: "other", sequence: 1, kind: "validation_started" },
    { actionExecutionId: "ax-1a", sequence: 1, kind: "validation_precheck_done", createdAt: "first" }
  ], "ax-1a")).toEqual([
    { sequence: 1, kind: "validation_precheck_done", createdAt: "first", role: "Validation · main" },
    { sequence: 2, kind: "work_started", createdAt: "later", role: "Work · subordinate" }
  ]));
  it.each([["prechecking", "active"], ["retrying", "attention"], ["blocked", "danger"], ["done", "healthy"]])("maps %s status to %s", (status, tone) => expect(statusPresentation(status).tone).toBe(tone));
  it("binds Critic approval to proposal hash and lets the server derive Feedback", () => expect(criticDecisionRequest({ critic_proposal_id: "critic-1", content_hash: "hash" }, "approved")).toEqual({ decision: "approved", expectedContentHash: "hash", expectedVersion: 2 }));
  it("binds Refinement approval to exact proposal, file, and Action hashes", () => expect(refinementDecisionRequest({ change_list_hash: "list", impact_scope_json: JSON.stringify({ actionIds: ["b", "a"] }), files: [{ proposed_content_hash: "z" }, { proposed_content_hash: "a" }] }, "approved")).toEqual({ decision: "approved", expectedContentHash: "list", expectedVersion: 2, expectedChangeHashes: ["a", "z"], expectedImpactActionIds: ["a", "b"], acknowledgeLocalCommitAndContinuation: true }));
  it("presents exact removed, added, and unchanged lines", () => expect(diffPresentation({ operation: "replace", relative_path: "a.md", expected_preimage_hash: "old", proposed_content_hash: "new", preimage_content: "same\nold\ntail", proposed_content: "same\nnew\ntail" }).lines).toEqual([
    { key: "=0", oldLine: 1, newLine: 1, marker: " ", text: "same" },
    { key: "-1", oldLine: 2, marker: "-", text: "old" },
    { key: "+1", newLine: 2, marker: "+", text: "new" },
    { key: "=2:2", oldLine: 3, newLine: 3, marker: " ", text: "tail" }
  ]));
  it("reconciles duplicate SSE refresh rows by stable id", () => expect(reconcileRows([{ id: "one", revision: 1 }], [{ id: "one", revision: 2 }, { id: "two", revision: 1 }], "id")).toEqual([{ id: "one", revision: 2 }, { id: "two", revision: 1 }]));
  it("projects immutable continuation ancestry without cycles", () => { const runs = [{ environmentRunId: "run-3", previousRunId: "run-2" }, { environmentRunId: "run-2", previousRunId: "run-1" }, { environmentRunId: "run-1" }] as RunSummary[]; expect(continuationLineage(runs[0]!, runs)).toEqual(["run-2", "run-1"]); });
});
