import { describe, expect, it } from "vitest";
import { calculateDetailLoopCanvasLayout } from "../src/workspace/automation/loops/loopDetailLayout";
import { calculateCompositeLoopCanvasLayout } from "../src/workspace/automation/loops/loopLayout";
import { buildLoopVisualProjection, visualNodeKey } from "../src/workspace/automation/loops/loopVisualProjection";
import { v11Automation, v11Loop } from "./v11Fixtures";

describe("strict-v11 graph projection", () => {
  it("projects Validation OK node edges and explicit terminals", () => {
    const loop = v11Loop();
    const projection = buildLoopVisualProjection(v11Automation(loop), loop);
    const records = projection.recordsByLoopId.get(loop.id)!;
    expect(projection.config.loops[0]?.start).toBe(visualNodeKey(loop.id, loop.startNodeId));
    expect(records[0]?.outputTargets).toEqual([expect.objectContaining({
      outputId: "ok",
      targetNodeKey: visualNodeKey(loop.id, "completed")
    })]);
    expect(projection.nodeByKey.get(visualNodeKey(loop.id, "completed"))?.terminal).toBe(true);
  });

  it("lays out single Work-owned artwork nodes deterministically without changing domain order", () => {
    const loop = v11Loop();
    const config = v11Automation(loop);
    const projection = buildLoopVisualProjection(config, loop);
    const input = {
      config: projection.config,
      selectedLoopId: loop.id,
      recordsByLoopId: projection.recordsByLoopId,
      direction: "horizontal" as const
    };
    const first = calculateCompositeLoopCanvasLayout(input);
    const second = calculateCompositeLoopCanvasLayout(input);
    const artwork = first.nodes.find((node) => node.kind === "work-loop-node");
    expect(second).toEqual(first);
    expect(artwork).toMatchObject({ width: 48, height: 48 });
    expect(loop.nodes.map((node) => node.id)).toEqual(["work"]);
  });

  it("uses Work nodeSize and ignores Validation appearance in canvas geometry", () => {
    const loop = v11Loop();
    loop.nodes[0]!.work.nodeSize = "tiny";
    loop.nodes[0]!.validation.nodeSize = "large";
    const projection = buildLoopVisualProjection(v11Automation(loop), loop);

    const layout = calculateCompositeLoopCanvasLayout({
      config: projection.config,
      selectedLoopId: loop.id,
      recordsByLoopId: projection.recordsByLoopId,
      direction: "horizontal"
    });

    expect(layout.nodes.find((node) => node.kind === "work-loop-node")).toMatchObject({ width: 24, height: 24 });
  });

  it("lays out Level 2 from selected-Loop records without compact linked Loops", () => {
    const selected = v11Loop("selected-loop");
    const linked = v11Loop("linked-loop");
    const config = v11Automation(selected, linked);
    config.graph.loopEdges = [{ id: "global", source: selected.id, target: linked.id, kind: "flow", capability: "test:loop.transfer", description: "Continue." }];
    const projection = buildLoopVisualProjection(config, selected);
    const records = projection.recordsByLoopId.get(selected.id)!;

    const layout = calculateDetailLoopCanvasLayout({ records });

    expect(layout.nodes.some((node) => node.kind === "loop")).toBe(false);
    expect(layout.nodes.every((node) => !node.key.includes(linked.id))).toBe(true);
    expect(layout.edges.every((edge) => edge.tone !== "cross-loop")).toBe(true);
  });
});
