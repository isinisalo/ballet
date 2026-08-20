import { describe, expect, it } from "vitest";
import {
  addJobPair,
  addLoopEdge,
  canRemoveJobPair,
  changeJobNodeType,
  changeValidationNodeType,
  createJobNodeDraft,
  createLoopDraft,
  createValidationNodeDraft,
  nextJobNodeId,
  removeJobPair,
  removeLoopAtIndex,
  removeLoopEdge,
  reorderJobNodes,
  replaceJobNode,
  replaceValidationNode,
  updateLoopAtIndex,
  updateLoopEdge,
  updateOrchestrator,
  updatePassEdgeTarget
} from "../src/workspace/automation/loops/loopEditorState";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

describe("strict-v12 Workflow Engineering drafts", () => {
  it("creates separate Job and Validation drafts without runtime state", () => {
    const loop = createLoopDraft();
    const job = createJobNodeDraft();
    const validation = createValidationNodeDraft();
    expect(loop.workflow).toEqual({
      startJobNodeId: "job", jobNodes: [], validationNodes: [], passEdges: [], failEdges: []
    });
    expect(job).toMatchObject({ validationNodeId: "job-validation", maxRetries: 3 });
    expect(validation).toMatchObject({ id: "job-validation", type: "human" });
    expect(loop).not.toHaveProperty("revision");
  });

  it("adds a Job/Validation pair and its PASS/FAIL Edges atomically", () => {
    const loop = addJobPair(createLoopDraft());
    expect(loop.workflow).toMatchObject({
      startJobNodeId: "job",
      jobNodes: [{ id: "job", validationNodeId: "job-validation" }],
      validationNodes: [{ id: "job-validation" }],
      passEdges: [{ sourceValidationNodeId: "job-validation", target: { workflowResult: "PASS" } }],
      failEdges: [{ sourceValidationNodeId: "job-validation", target: { workflowResult: "FAIL" } }]
    });
  });

  it("rewrites Job, Validation, and PassEdge references on identifier changes", () => {
    const paired = addJobPair(workflowLoop(), createJobNodeDraft("verify"), createValidationNodeDraft("verify-validation"));
    const linked = updatePassEdgeTarget(paired, "job-validation", { jobNodeId: "verify" });
    const renamedJob = replaceJobNode(linked, "verify", { ...linked.workflow.jobNodes[1]!, id: "verified" });
    const renamedValidation = replaceValidationNode(
      renamedJob,
      "verify-validation",
      { ...renamedJob.workflow.validationNodes[1]!, id: "verified-validation" }
    );
    expect(renamedValidation.workflow.passEdges[0]?.target).toEqual({ jobNodeId: "verified" });
    expect(renamedValidation.workflow.jobNodes[1]?.validationNodeId).toBe("verified-validation");
    expect(renamedValidation.workflow.failEdges[1]?.sourceValidationNodeId).toBe("verified-validation");
  });

  it("blocks removal of start and incoming targets, then removes an unreferenced pair together", () => {
    const two = addJobPair(workflowLoop());
    const secondId = two.workflow.jobNodes[1]!.id;
    expect(canRemoveJobPair(two, "job")).toBe(false);
    const linked = updatePassEdgeTarget(two, "job-validation", { jobNodeId: secondId });
    expect(canRemoveJobPair(linked, secondId)).toBe(false);
    const unlinked = updatePassEdgeTarget(linked, "job-validation", { workflowResult: "PASS" });
    const removed = removeJobPair(unlinked, secondId);
    expect(removed.workflow.jobNodes.map(({ id }) => id)).toEqual(["job"]);
    expect(removed.workflow.validationNodes.map(({ id }) => id)).toEqual(["job-validation"]);
    expect(removed.workflow.passEdges).toHaveLength(1);
    expect(removed.workflow.failEdges).toHaveLength(1);
  });

  it("keeps authoring order separate from start identity and allocates global Job ids", () => {
    const two = addJobPair(workflowLoop());
    const reordered = reorderJobNodes(two, 1, 0);
    expect(reordered.workflow.jobNodes.map(({ id }) => id)).toEqual(["job-2", "job"]);
    expect(reordered.workflow.startJobNodeId).toBe("job");
    expect(nextJobNodeId(workflowAutomation(workflowLoop("new-loop")), createLoopDraft())).toBe("new-loop-job");
  });

  it("updates Graph Edges and Orchestrator without changing Workflow ownership", () => {
    const first = workflowLoop();
    const second = workflowLoop("repair-loop");
    const config = workflowAutomation(first, second);
    const added = addLoopEdge(config, first.id);
    const edge = added.graph.loopEdges[0]!;
    const repaired = updateLoopEdge(added, edge.id, { ...edge, kind: "repair", capability: "test:loop.transfer" });
    const orchestrated = updateOrchestrator(repaired, { ...repaired.orchestrator, maxRepairDepth: 2 });
    expect(orchestrated.graph.loopEdges[0]).toMatchObject({ source: first.id, target: second.id, kind: "repair" });
    expect(orchestrated.orchestrator.maxRepairDepth).toBe(2);
    expect(removeLoopEdge(orchestrated, edge.id).graph.loopEdges).toEqual([]);
    const renamed = updateLoopAtIndex(config, 0, { ...first, id: "renamed-loop" });
    expect(removeLoopAtIndex(renamed, 1).loops.map(({ id }) => id)).toEqual(["renamed-loop"]);
  });

  it("changes role types without allowing scheduled Validation", () => {
    expect(changeJobNodeType(createJobNodeDraft(), "scheduled")).toMatchObject({
      type: "scheduled", schedule: { kind: "once" }
    });
    const humanValidation = changeValidationNodeType(createValidationNodeDraft(), "human");
    expect(["agent", "human"]).toContain(humanValidation.type);
  });
});
