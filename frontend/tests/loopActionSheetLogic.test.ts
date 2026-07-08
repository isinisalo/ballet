import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId, humanGateResponseId, policyOutputEventType } from "@shared/policy-actions";
import {
  nextConfigWithLoopHandlerAction,
  nextConfigWithLoopStepAction,
  nextConfigWithLoopStepActions,
  nextConfigWithoutLoopStepIndexes
} from "../src/workspace/automation/loops/loopActionSheetLogic";

const loopId = "delivery";

const loopEvent = (event: string | undefined, scopedLoopId = loopId) =>
  event && !event.startsWith(`${scopedLoopId}.`) ? `${scopedLoopId}.${event}` : event;

const policy = (patch: Partial<ProjectPolicy>): ProjectPolicy => {
  const policyLoopId = patch.loopId ?? loopId;
  const event = loopEvent(patch.event ?? "manual-start", policyLoopId) ?? "manual-start";
  const action = patch.action ?? "build";
  return {
    id: patch.id ?? generatedPolicyId({
      loopId: policyLoopId,
      event,
      action
    }),
    loopId: policyLoopId,
    source: "event",
    event,
    action,
    enabled: patch.enabled ?? true
  };
};

const config = (policies: ProjectPolicy[]): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    { id: "build", description: "Build the change.", outputIds: ["ready", "blocked"], agentIds: ["builder-agent"] },
    { id: "review", description: "Review the change.", outputIds: ["approved", "changes-requested"], agentIds: ["reviewer-agent"] }
  ],
  outputs: [{ id: "ready" }, { id: "blocked" }, { id: "approved" }, { id: "changes-requested" }],
  outputRoutes: [],
  humanGateResponses: [],
  policies,
  loops: [{ id: loopId, steps: policies.map((item) => item.id) }],
  runtimes: []
});

describe("nextConfigWithLoopStepAction", () => {
  it("creates a policy for the selected step with the new action", () => {
    const startPolicy = policy({ source: "event", event: "manual-start", action: "build" });
    const current = config([startPolicy]);
    const next = nextConfigWithLoopStepAction(current, loopId, 0, "review");
    const expectedPolicyId = generatedPolicyId({ ...startPolicy, action: "review" });

    expect(next).not.toBe(current);
    expect(next.actions).toBe(current.actions);
    expect(next.policies).toEqual([
      { ...startPolicy, id: expectedPolicyId, action: "review" }
    ]);
    expect(next.loops[0]?.steps).toEqual([expectedPolicyId]);
  });

  it("reuses an existing matching policy without duplicating it", () => {
    const buildPolicy = policy({ source: "event", event: "build.ready", action: "build" });
    const reviewPolicy = policy({ source: "event", event: "build.ready", action: "review" });
    const current = config([buildPolicy, reviewPolicy]);
    const next = nextConfigWithLoopStepAction(current, loopId, 0, "review");

    expect(next.policies).toEqual([reviewPolicy]);
    expect(next.loops[0]?.steps).toEqual([reviewPolicy.id, reviewPolicy.id]);
  });

  it("returns the current config for invalid loop, step, or action", () => {
    const startPolicy = policy({ source: "event", event: "manual-start", action: "build" });
    const current = config([startPolicy]);

    expect(nextConfigWithLoopStepAction(current, "missing", 0, "review")).toBe(current);
    expect(nextConfigWithLoopStepAction(current, loopId, 5, "review")).toBe(current);
    expect(nextConfigWithLoopStepAction(current, loopId, 0, "missing")).toBe(current);
    expect(nextConfigWithLoopStepAction(current, loopId, 0, "build")).toBe(current);
  });

  it("creates replacement policies for every selected folded step", () => {
    const startPolicy = policy({ source: "event", event: "manual-start", action: "build" });
    const reviewPolicy = policy({ source: "event", event: "build.ready", action: "review" });
    const reworkPolicy = policy({ source: "event", event: "review.changes-requested", action: "build" });
    const current = config([startPolicy, reviewPolicy, reworkPolicy]);
    const next = nextConfigWithLoopStepActions(current, loopId, [0, 2], "review");
    const expectedStartPolicyId = generatedPolicyId({ ...startPolicy, action: "review" });
    const expectedReworkPolicyId = generatedPolicyId({ ...reworkPolicy, action: "review" });

    expect(next.policies).toEqual([
      reviewPolicy,
      { ...startPolicy, id: expectedStartPolicyId, action: "review" },
      { ...reworkPolicy, id: expectedReworkPolicyId, action: "review" }
    ]);
    expect(next.loops[0]?.steps).toEqual([
      expectedStartPolicyId,
      reviewPolicy.id,
      expectedReworkPolicyId
    ]);
  });

  it("removes every selected folded step from the loop", () => {
    const startPolicy = policy({ source: "event", event: "manual-start", action: "build" });
    const reviewPolicy = policy({ source: "event", event: "build.ready", action: "review" });
    const reworkPolicy = policy({ source: "event", event: "review.changes-requested", action: "build" });
    const current = config([startPolicy, reviewPolicy, reworkPolicy]);
    const next = nextConfigWithoutLoopStepIndexes(current, loopId, [0, 2]);

    expect(next.policies).toBe(current.policies);
    expect(next.loops[0]?.steps).toEqual([reviewPolicy.id]);
  });

  it("updates only the selected output handler route", () => {
    const startPolicy = policy({ id: "start-build", source: "event", event: "manual-start", action: "build" });
    const reviewPolicy = policy({ id: "review-ready", source: "event", event: "build.ready", action: "review" });
    const reworkPolicy = policy({ id: "rework-build", source: "event", event: "review.changes-requested", action: "build" });
    const current = config([startPolicy, reviewPolicy, reworkPolicy]);
    const next = nextConfigWithLoopHandlerAction(current, loopId, 2, "review");
    const expectedReworkPolicyId = generatedPolicyId({ ...reworkPolicy, action: "review" });

    expect(next).not.toBe(current);
    expect(next.loops[0]?.steps).toEqual([
      startPolicy.id,
      reviewPolicy.id,
      expectedReworkPolicyId
    ]);
    expect(next.policies).toContainEqual({ ...reworkPolicy, id: expectedReworkPolicyId, action: "review" });
  });

  it("reuses an existing policy for the selected output handler route", () => {
    const startPolicy = policy({ source: "event", event: "manual-start", action: "build" });
    const reworkBuildPolicy = policy({ source: "event", event: "review.changes-requested", action: "build" });
    const reworkReviewPolicy = policy({ source: "event", event: "review.changes-requested", action: "review" });
    const current = config([startPolicy, reworkBuildPolicy, reworkReviewPolicy]);
    const next = nextConfigWithLoopHandlerAction(current, loopId, 1, "review");

    expect(next.policies).toEqual([startPolicy, reworkReviewPolicy]);
    expect(next.loops[0]?.steps).toEqual([
      startPolicy.id,
      reworkReviewPolicy.id,
      reworkReviewPolicy.id
    ]);
  });
});

describe("nextConfigWithLoopHandlerAction route cleanup", () => {
  it("rewrites routes and removes stale human gate responses when a loop step action changes", () => {
    const scopedLoopId = "delivery.loop";
    const startPolicy = policy({ loopId: scopedLoopId, source: "event", event: "start", action: "review" });
    const gatePolicy = policy({
      loopId: scopedLoopId,
      source: "event",
      event: policyOutputEventType({ action: "review", loopId: scopedLoopId }, "rejected"),
      action: "human-review"
    });
    const donePolicy = policy({
      loopId: scopedLoopId,
      source: "event",
      event: policyOutputEventType({ action: "human-review", loopId: scopedLoopId }, "rejected"),
      action: "done"
    });
    const gateResponseBase = {
      loopId: scopedLoopId,
      policyId: gatePolicy.id,
      actionId: "human-review",
      outputId: "rejected",
      prompt: "Please rework this.",
      submittedAt: "2026-07-07T10:00:00.000Z"
    };
    const current: ProjectAutomationConfig = {
      version: 1,
      actions: [
        { id: "review", description: "Review.", outputIds: ["approved", "rejected"], agentIds: ["reviewer-agent"] },
        { id: "human-review", description: "Human review.", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true },
        { id: "done", description: "Done.", outputIds: [], agentIds: [] }
      ],
      outputs: [{ id: "approved" }, { id: "rejected" }],
      outputRoutes: [
        { sourcePolicyId: startPolicy.id, outputId: "rejected", target: { type: "policy", policyId: gatePolicy.id } },
        { sourcePolicyId: gatePolicy.id, outputId: "rejected", target: { type: "policy", policyId: donePolicy.id } }
      ],
      humanGateResponses: [{ ...gateResponseBase, id: humanGateResponseId(gateResponseBase) }],
      policies: [startPolicy, gatePolicy, donePolicy],
      loops: [{ id: scopedLoopId, steps: [startPolicy.id, gatePolicy.id, donePolicy.id] }],
      runtimes: []
    };

    const next = nextConfigWithLoopHandlerAction(current, scopedLoopId, 1, "done");
    const nextGatePolicyId = generatedPolicyId({ ...gatePolicy, action: "done" });

    expect(next.loops[0]?.steps).toEqual([startPolicy.id, nextGatePolicyId, donePolicy.id]);
    expect(next.policies.some((candidate) => candidate.id === gatePolicy.id)).toBe(false);
    expect(next.outputRoutes).toEqual([
      { sourcePolicyId: startPolicy.id, outputId: "rejected", target: { type: "policy", policyId: nextGatePolicyId } }
    ]);
    expect(next.humanGateResponses).toEqual([]);
  });
});
