import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  defaultTransitionFor,
  loopNodeStyleCatalog,
  loopNodeStyles,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";

const config = (): ProjectAutomationConfig => ({
  version: 7,
  loops: [{
    id: "delivery",
    start: "gate",
    steps: [{
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeStyle: "flat",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    }]
  }]
});

describe("v7 node style catalog", () => {
  it("defines all nine intrinsic styles and their fixed sizes", () => {
    expect(loopNodeStyles).toEqual([
      "flat", "luna", "black-hole", "satellite", "meteorite", "spaceman", "mars", "terra", "sol"
    ]);
    expect(Object.fromEntries(loopNodeStyles.map((style) => [style, loopNodeStyleCatalog[style]]))).toEqual({
      flat: { label: "Flat", size: "medium", pixels: 48 },
      luna: { label: "Luna", size: "tiny", pixels: 24 },
      "black-hole": { label: "Black hole", size: "tiny", pixels: 24 },
      satellite: { label: "Satellite", size: "tiny", pixels: 24 },
      meteorite: { label: "Meteorite", size: "tiny", pixels: 24 },
      spaceman: { label: "Spaceman", size: "tiny", pixels: 24 },
      mars: { label: "Mars", size: "small", pixels: 36 },
      terra: { label: "Terra", size: "medium", pixels: 48 },
      sol: { label: "Sol", size: "large", pixels: 64 }
    });
  });

  it("accepts every style and rejects legacy size and loop theme fields", () => {
    const base = config();
    for (const nodeStyle of loopNodeStyles) {
      expect(automationConfigSchema.safeParse({
        ...base,
        loops: [{
          ...base.loops[0],
          steps: base.loops[0]!.steps.map((step) => ({ ...step, nodeStyle }))
        }]
      }).success).toBe(true);
    }
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], theme: "legacy" }]
    }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{
        ...base.loops[0],
        steps: base.loops[0]!.steps.map((step) => ({ ...step, nodeSize: "medium" }))
      }]
    }).success).toBe(false);
  });

  it("provides completed and blocked defaults for required outputs", () => {
    expect(defaultTransitionFor("approved")).toEqual({ end: "completed" });
    expect(defaultTransitionFor("rejected")).toEqual({ end: "blocked" });
  });
});
