import { describe, expect, it } from "vitest";
import { buildLoopVisualProjection, visualStepKey } from "../src/workspace/automation/loops/loopVisualProjection";
import { v10Automation, v10Loop } from "./v10Fixtures";

describe("strict-v10 graph projection", () => {
  it("projects Validation OK node edges and explicit terminals", () => {
    const loop = v10Loop();
    const projection = buildLoopVisualProjection(v10Automation(loop), loop);
    const records = projection.recordsByLoopId.get(loop.id)!;
    expect(projection.config.loops[0]?.start).toBe(visualStepKey(loop.id, loop.startNodeId));
    expect(records[0]?.outputTargets).toEqual([expect.objectContaining({
      outputId: "ok",
      targetStepKey: visualStepKey(loop.id, "completed")
    })]);
    expect(projection.stepByKey.get(visualStepKey(loop.id, "completed"))?.terminal).toBe(true);
  });
});
