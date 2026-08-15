import { describe, expect, it } from "vitest";
import {
  createLoopDraft,
  createWorkLoopNodeDraft,
  removeLoopAtIndex,
  replaceWorkLoopNode,
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
    const loop = v10Loop();
    const renamedNode = { ...loop.nodes[0]!, id: "renamed" };
    const nodeUpdated = replaceWorkLoopNode(loop, "work", renamedNode);
    expect(nodeUpdated.startNodeId).toBe("renamed");
    expect(nodeUpdated.edges[0]).toMatchObject({ source: "renamed" });

    const other = v10Loop("other-loop");
    const config = v10Automation(loop, other);
    config.loopEdges = [{ id: "main-flow", source: loop.id, target: other.id, kind: "flow", description: "Continue." }];
    const loopUpdated = updateLoopAtIndex(config, 0, { ...loop, id: "renamed-loop" });
    expect(loopUpdated.loopEdges[0]).toMatchObject({ source: "renamed-loop", target: "other-loop" });
    expect(removeLoopAtIndex(loopUpdated, 1).loopEdges).toEqual([]);
  });
});
