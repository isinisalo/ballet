import { describe, expect, it } from "vitest";
import {
  addLoopEdge,
  addWorkLoopNode,
  changeValidationNodeType,
  changeWorkNodeType,
  createLoopDraft,
  createWorkLoopNodeDraft,
  nextWorkLoopNodeId,
  removeLoopEdge,
  removeLoopAtIndex,
  removeWorkLoopNode,
  reorderWorkLoopNodes,
  replaceWorkLoopNode,
  updateLoopEdge,
  updateNodeEdgeTarget,
  updateOrchestrator,
  updateLoopAtIndex
} from "../src/workspace/automation/loops/loopEditorState";
import { v10Automation, v10Loop } from "./v10Fixtures";

describe("strict-v10 frontend drafts", () => {
  it("creates nested Work/Validation drafts without mutable runtime state", () => {
    const loop = createLoopDraft();
    const node = createWorkLoopNodeDraft();
    expect(loop).toMatchObject({ startNodeId: "work", state: { initial: {} }, nodes: [], edges: [] });
    expect(node).toHaveProperty("work.task");
    expect(node).toHaveProperty("validation.task");
    expect(node).not.toHaveProperty("on");
    expect(loop).not.toHaveProperty("revision");
  });

  it("rewrites stable node and Loop Edge references on identifier changes", () => {
    const loop = addWorkLoopNode(v10Loop(), createWorkLoopNodeDraft("verify"));
    const linked = updateNodeEdgeTarget(loop, "work", { nodeId: "verify" });
    const renamedNode = { ...linked.nodes[1]!, id: "verified" };
    const nodeUpdated = replaceWorkLoopNode(linked, "verify", renamedNode);
    expect(nodeUpdated.startNodeId).toBe("work");
    expect(nodeUpdated.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "work", target: { nodeId: "verified" } }),
      expect.objectContaining({ source: "verified" })
    ]));

    const other = v10Loop("other-loop");
    const config = v10Automation(loop, other);
    config.loopEdges = [{ id: "main-flow", source: loop.id, target: other.id, kind: "flow", description: "Continue." }];
    const loopUpdated = updateLoopAtIndex(config, 0, { ...loop, id: "renamed-loop" });
    expect(loopUpdated.loopEdges[0]).toMatchObject({ source: "renamed-loop", target: "other-loop" });
    expect(removeLoopAtIndex(loopUpdated, 1).loopEdges).toEqual([]);
  });

  it("allocates a globally unique default node id for the editor", () => {
    const existing = v10Loop("new-loop");
    existing.nodes[0] = { ...existing.nodes[0]!, id: "new-loop-work" };
    existing.startNodeId = "new-loop-work";
    existing.edges[0] = { ...existing.edges[0]!, source: "new-loop-work" };
    expect(nextWorkLoopNodeId(v10Automation(existing), createLoopDraft())).toBe("new-loop-work-2");
  });

  it("adds composite nodes with one OK edge and preserves semantic order on reorder", () => {
    const first = addWorkLoopNode(createLoopDraft());
    const second = addWorkLoopNode(first);
    expect(first).toMatchObject({ startNodeId: "work", nodes: [{ id: "work" }] });
    expect(first.edges).toEqual([{ id: "new-loop-work-ok", source: "work", target: { terminal: "completed" } }]);
    expect(second.nodes.map((node) => node.id)).toEqual(["work", "work-2"]);

    const reordered = reorderWorkLoopNodes(second, 1, 0);
    expect(reordered.nodes.map((node) => node.id)).toEqual(["work-2", "work"]);
    expect(reordered.startNodeId).toBe("work");
    expect(reordered.edges).toEqual(second.edges);
  });

  it("removes dangling references and redirects incoming OK edges to completed", () => {
    const loop = addWorkLoopNode(addWorkLoopNode(createLoopDraft()));
    const chained = updateNodeEdgeTarget(loop, "work", { nodeId: "work-2" });
    const removed = removeWorkLoopNode(chained, "work-2");
    expect(removed.nodes.map((node) => node.id)).toEqual(["work"]);
    expect(removed.edges).toEqual([{ id: "new-loop-work-ok", source: "work", target: { terminal: "completed" } }]);
  });

  it("updates Loop Edges and orchestrator without introducing a parallel draft model", () => {
    const first = v10Loop();
    const second = v10Loop("repair-loop");
    const config = v10Automation(first, second);
    const added = addLoopEdge(config, first.id);
    const edge = added.loopEdges[0]!;
    const repaired = updateLoopEdge(added, edge.id, { ...edge, kind: "repair", description: "Repair capability." });
    const orchestrated = updateOrchestrator(repaired, { ...repaired.orchestrator, maxRepairDepth: 2 });
    expect(orchestrated.loopEdges[0]).toMatchObject({ source: first.id, target: second.id, kind: "repair" });
    expect(orchestrated.orchestrator.maxRepairDepth).toBe(2);
    expect(removeLoopEdge(orchestrated, edge.id).loopEdges).toEqual([]);
  });

  it("changes role types without allowing scheduled Validation", () => {
    const draft = createWorkLoopNodeDraft();
    const scheduled = changeWorkNodeType(draft.work, "scheduled");
    const humanValidation = changeValidationNodeType(draft.validation, "human");
    expect(scheduled).toMatchObject({ type: "scheduled", schedule: { kind: "once" } });
    expect(humanValidation.type).toBe("human");
    expect(["agent", "human"]).toContain(humanValidation.type);
  });
});
