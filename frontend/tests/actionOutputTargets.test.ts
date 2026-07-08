import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { generatedPolicyId, policyOutputEventType } from "@shared/policy-actions";
import { actionOutputTargetsByOutputId } from "../src/workspace/automation/actions/actionOutputTargets";

const config = (): Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies"> => ({
  actions: [
    { id: "review", description: "Review.", outputIds: ["accepted"], agentIds: ["reviewer-agent"] },
    { id: "human-review", description: "Human review.", outputIds: ["approved", "changes-requested"], agentIds: [], humanGate: true }
  ],
  outputRoutes: [],
  policies: [
    { id: "review-policy", source: "event", event: "review.ready", action: "review", enabled: true },
    { id: "human-review-policy", source: "event", event: "review.approved", action: "human-review", enabled: true }
  ]
});

describe("actionOutputTargetsByOutputId", () => {
  it("labels event outputs with the generated event type", () => {
    expect(actionOutputTargetsByOutputId(config(), "review", ["accepted"])).toEqual({
      accepted: [{ type: "event", id: "review.accepted", label: "review.accepted" }]
    });
  });

  it("derives event targets for human gate approval outputs", () => {
    expect(actionOutputTargetsByOutputId(config(), "human-review", ["approved", "changes-requested"])).toEqual({
      approved: [{ type: "event", id: "human-review.approved", label: "human-review.approved" }],
      "changes-requested": [{ type: "event", id: "human-review.changes-requested", label: "human-review.changes-requested" }]
    });
  });

  it("returns every loop-specific handler policy for reused actions", () => {
    const firstLoopId = "first.loop";
    const secondLoopId = "second.loop";
    const firstSource = { loopId: firstLoopId, source: "event" as const, event: "first.loop.ready", action: "review", enabled: true };
    const secondSource = { loopId: secondLoopId, source: "event" as const, event: "second.loop.ready", action: "review", enabled: true };
    const firstHandler = { loopId: firstLoopId, source: "event" as const, event: policyOutputEventType({ action: "review", loopId: firstLoopId }, "accepted"), action: "done", enabled: true };
    const secondHandler = { loopId: secondLoopId, source: "event" as const, event: policyOutputEventType({ action: "review", loopId: secondLoopId }, "accepted"), action: "done", enabled: true };
    const current: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies"> = {
      actions: [
        { id: "review", description: "Review.", outputIds: ["accepted"], agentIds: ["reviewer-agent"] },
        { id: "done", description: "Done.", outputIds: [], agentIds: [] }
      ],
      outputRoutes: [],
      policies: [
        { ...firstSource, id: generatedPolicyId(firstSource) },
        { ...secondSource, id: generatedPolicyId(secondSource) },
        { ...firstHandler, id: generatedPolicyId(firstHandler) },
        { ...secondHandler, id: generatedPolicyId(secondHandler) }
      ]
    };

    expect(actionOutputTargetsByOutputId(current, "review", ["accepted"])).toEqual({
      accepted: [
        { type: "policy", id: generatedPolicyId(firstHandler), label: generatedPolicyId(firstHandler) },
        { type: "policy", id: generatedPolicyId(secondHandler), label: generatedPolicyId(secondHandler) }
      ]
    });
  });

  it("shows challenge-project-brief output handlers as policy ids", () => {
    const loopId = "adr-goals-changed.loop";
    const source = {
      loopId,
      source: "event" as const,
      event: policyOutputEventType({ action: "create-project-brief", loopId }, "approved"),
      action: "challenge-project-brief",
      enabled: true
    };
    const approvedHandler = {
      loopId,
      source: "event" as const,
      event: policyOutputEventType({ action: "challenge-project-brief", loopId }, "approved"),
      action: "project-brief-gate",
      enabled: true
    };
    const rejectedHandler = {
      loopId,
      source: "event" as const,
      event: policyOutputEventType({ action: "challenge-project-brief", loopId }, "rejected"),
      action: "create-project-brief",
      enabled: true
    };
    const current: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies"> = {
      actions: [
        { id: "challenge-project-brief", description: "Challenge.", outputIds: ["approved", "rejected"], agentIds: ["critic-agent"] },
        { id: "project-brief-gate", description: "Gate.", outputIds: ["approved", "rejected"], agentIds: [], humanGate: true },
        { id: "create-project-brief", description: "Create.", outputIds: ["approved", "rejected"], agentIds: ["writer-agent"] }
      ],
      outputRoutes: [],
      policies: [
        { ...source, id: generatedPolicyId(source) },
        { ...approvedHandler, id: generatedPolicyId(approvedHandler) },
        { ...rejectedHandler, id: generatedPolicyId(rejectedHandler) }
      ]
    };

    expect(actionOutputTargetsByOutputId(current, "challenge-project-brief", ["approved", "rejected"])).toEqual({
      approved: [{ type: "policy", id: generatedPolicyId(approvedHandler), label: generatedPolicyId(approvedHandler) }],
      rejected: [{ type: "policy", id: generatedPolicyId(rejectedHandler), label: generatedPolicyId(rejectedHandler) }]
    });
  });
});
