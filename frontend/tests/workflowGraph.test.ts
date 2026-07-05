import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { buildWorkflowGraph, workflowOutputEvents, workflowTriggerLabel } from "../src/workspace/automation/workflows/workflowGraph";

const policy = (patch: Partial<ProjectPolicy>): ProjectPolicy => ({
  id: patch.id ?? "policy",
  source: patch.source ?? "event",
  event: patch.event,
  trigger: patch.trigger,
  action: patch.action ?? "build",
  enabled: true
});

describe("workflow graph", () => {
  it("groups event policies under the latest parent output event", () => {
    const parent = policy({ id: "parent", event: "external.start", action: "deploy" });
    const child = policy({ id: "child", event: "deploy.failed", action: "repair" });
    const graph = buildWorkflowGraph([
      { policyId: parent.id, index: 0, policy: parent, outputEvents: ["deploy.failed"] },
      { policyId: child.id, index: 1, policy: child, outputEvents: ["repair.complete"] }
    ]);

    expect(graph.rootRecords.map((record) => record.policyId)).toEqual(["parent"]);
    expect(graph.childRecordsByParentEvent.get("0:deploy.failed")?.map((record) => record.policyId)).toEqual(["child"]);
  });

  it("indexes every existing policy handler by input event", () => {
    const first = policy({ id: "first-handler", event: "deploy.completed", action: "review" });
    const second = policy({ id: "second-handler", event: "deploy.completed", action: "audit" });
    const graph = buildWorkflowGraph([
      { policyId: first.id, index: 0, policy: first, outputEvents: ["review.complete"] },
      { policyId: second.id, index: 1, policy: second, outputEvents: ["audit.complete"] }
    ]);

    expect(graph.eventHandlerRecordsByEvent.get("deploy.completed")?.map((record) => record.policyId)).toEqual([
      "first-handler",
      "second-handler"
    ]);
  });

  it("keeps orphan policies as roots and labels triggers", () => {
    const triggerPolicy = policy({ source: "trigger", trigger: "manual-start", event: undefined });
    expect(workflowTriggerLabel(triggerPolicy)).toBe("manual-start");
    expect(workflowOutputEvents(undefined)).toEqual(["Missing policy"]);
    expect(buildWorkflowGraph([{ policyId: "orphan", index: 0 }]).rootRecords).toEqual([{ policyId: "orphan", index: 0 }]);
  });
});
