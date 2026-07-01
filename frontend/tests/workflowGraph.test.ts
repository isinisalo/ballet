import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { buildWorkflowGraph, workflowOutputEvents, workflowTriggerLabel } from "../src/workspace/automation/workflows/workflowGraph";
import { workflowConnectorPath } from "../src/workspace/automation/workflows/workflowLayout";

const policy = (patch: Partial<ProjectPolicy>): ProjectPolicy => ({
  id: patch.id ?? "policy",
  source: patch.source ?? "event",
  event: patch.event,
  trigger: patch.trigger,
  agent: patch.agent ?? "agent",
  action: patch.action ?? "build",
  enabled: true
});

describe("workflow graph", () => {
  it("groups event policies under the latest parent output event", () => {
    const parent = policy({ id: "parent", event: "external.start", agent: "builder", action: "deploy" });
    const child = policy({ id: "child", event: "builder.deploy.failed", agent: "fixer", action: "repair" });
    const graph = buildWorkflowGraph([
      { policyId: parent.id, index: 0, policy: parent, outputEvents: ["builder.deploy.failed"] },
      { policyId: child.id, index: 1, policy: child, outputEvents: ["fixer.repair.complete"] }
    ]);

    expect(graph.rootRecords.map((record) => record.policyId)).toEqual(["parent"]);
    expect(graph.childRecordsByParentEvent.get("0:builder.deploy.failed")?.map((record) => record.policyId)).toEqual(["child"]);
  });

  it("indexes every existing policy handler by input event", () => {
    const first = policy({ id: "first-handler", event: "builder.deploy.completed", agent: "reviewer", action: "review" });
    const second = policy({ id: "second-handler", event: "builder.deploy.completed", agent: "auditor", action: "audit" });
    const graph = buildWorkflowGraph([
      { policyId: first.id, index: 0, policy: first, outputEvents: ["reviewer.review.complete"] },
      { policyId: second.id, index: 1, policy: second, outputEvents: ["auditor.audit.complete"] }
    ]);

    expect(graph.eventHandlerRecordsByEvent.get("builder.deploy.completed")?.map((record) => record.policyId)).toEqual([
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

describe("workflow layout", () => {
  it("builds straight and elbow connector paths", () => {
    expect(workflowConnectorPath({ key: "flat", from: { x: 0, y: 10 }, to: { x: 100, y: 11 } })).toBe("M 0 10 H 100");
    expect(workflowConnectorPath({ key: "elbow", from: { x: 0, y: 10 }, to: { x: 100, y: 80 } })).toBe("M 0 10 H 48 V 80 H 100");
  });
});
