import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId } from "@shared/policy-actions";
import { nextConfigWithWorkflowStepAction } from "../src/workspace/automation/workflows/workflowActionSheetLogic";

const policy = (patch: Partial<ProjectPolicy>): ProjectPolicy => ({
  id: patch.id ?? generatedPolicyId({
    source: patch.source ?? "event",
    event: patch.event,
    trigger: patch.trigger,
    action: patch.action ?? "build"
  }),
  source: patch.source ?? "event",
  event: patch.event,
  trigger: patch.trigger,
  action: patch.action ?? "build",
  enabled: patch.enabled ?? true
});

const config = (policies: ProjectPolicy[]): ProjectAutomationConfig => ({
  version: 1,
  triggers: [{ id: "manual-start", description: "Manual start" }],
  actions: [
    { id: "build", description: "Build the change.", outputIds: ["ready", "blocked"], agentIds: ["builder-agent"] },
    { id: "review", description: "Review the change.", outputIds: ["approved", "changes-requested"], agentIds: ["reviewer-agent"] }
  ],
  outputs: [{ id: "ready" }, { id: "blocked" }, { id: "approved" }, { id: "changes-requested" }],
  policies,
  workflows: [{ id: "delivery", title: "Delivery", steps: policies.map((item) => item.id) }],
  runtimes: []
});

describe("nextConfigWithWorkflowStepAction", () => {
  it("creates a policy for the selected step with the new action", () => {
    const startPolicy = policy({ source: "trigger", trigger: "manual-start", action: "build" });
    const current = config([startPolicy]);
    const next = nextConfigWithWorkflowStepAction(current, "delivery", 0, "review");
    const expectedPolicyId = generatedPolicyId({ ...startPolicy, action: "review" });

    expect(next).not.toBe(current);
    expect(next.actions).toBe(current.actions);
    expect(next.policies).toEqual([
      startPolicy,
      { ...startPolicy, id: expectedPolicyId, action: "review" }
    ]);
    expect(next.workflows[0]?.steps).toEqual([expectedPolicyId]);
  });

  it("reuses an existing matching policy without duplicating it", () => {
    const buildPolicy = policy({ source: "event", event: "build.ready", action: "build" });
    const reviewPolicy = policy({ source: "event", event: "build.ready", action: "review" });
    const current = config([buildPolicy, reviewPolicy]);
    const next = nextConfigWithWorkflowStepAction(current, "delivery", 0, "review");

    expect(next.policies).toBe(current.policies);
    expect(next.workflows[0]?.steps).toEqual([reviewPolicy.id, reviewPolicy.id]);
  });

  it("returns the current config for invalid workflow, step, or action", () => {
    const startPolicy = policy({ source: "trigger", trigger: "manual-start", action: "build" });
    const current = config([startPolicy]);

    expect(nextConfigWithWorkflowStepAction(current, "missing", 0, "review")).toBe(current);
    expect(nextConfigWithWorkflowStepAction(current, "delivery", 5, "review")).toBe(current);
    expect(nextConfigWithWorkflowStepAction(current, "delivery", 0, "missing")).toBe(current);
    expect(nextConfigWithWorkflowStepAction(current, "delivery", 0, "build")).toBe(current);
  });
});
