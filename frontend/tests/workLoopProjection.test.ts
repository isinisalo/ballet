import { describe, expect, it } from "vitest";
import { calculateCompositeLoopCanvasLayout } from "../src/workspace/automation/loops/loopLayout";
import { buildLoopVisualProjection, visualNodeKey } from "../src/workspace/automation/loops/loopVisualProjection";
import { v10Automation, v10Loop } from "./v10Fixtures";

describe("strict-v10 graph projection", () => {
  it("projects Validation OK node edges and explicit terminals", () => {
    const loop = v10Loop();
    const projection = buildLoopVisualProjection(v10Automation(loop), loop);
    const records = projection.recordsByLoopId.get(loop.id)!;
    expect(projection.config.loops[0]?.start).toBe(visualNodeKey(loop.id, loop.startNodeId));
    expect(records[0]?.outputTargets).toEqual([expect.objectContaining({
      outputId: "ok",
      targetNodeKey: visualNodeKey(loop.id, "completed")
    })]);
    expect(projection.nodeByKey.get(visualNodeKey(loop.id, "completed"))?.terminal).toBe(true);
  });

  it("lays out composite nodes deterministically without changing domain order", () => {
    const loop = v10Loop();
    const config = v10Automation(loop);
    const projection = buildLoopVisualProjection(config, loop);
    const input = {
      config: projection.config,
      selectedLoopId: loop.id,
      recordsByLoopId: projection.recordsByLoopId,
      direction: "horizontal" as const
    };
    const first = calculateCompositeLoopCanvasLayout(input);
    const second = calculateCompositeLoopCanvasLayout(input);
    const composite = first.nodes.find((node) => node.kind === "work-loop-node");
    expect(second).toEqual(first);
    expect(composite).toMatchObject({ width: 224, height: 132 });
    expect(loop.nodes.map((node) => node.id)).toEqual(["work"]);
  });
});
