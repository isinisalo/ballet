import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  loopNodeSizeCatalog,
  loopNodeSizes,
  loopNodeStyleCatalog,
  loopNodeStyles,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";
import { testAutomationConfig } from "./v10TestConfig.js";

const config = (): ProjectAutomationConfig => testAutomationConfig();

describe("v10 Work and Validation Node appearance catalogs", () => {
  it("defines six ordered styles with group metadata and four explicit sizes", () => {
    expect(loopNodeStyles).toEqual([
      "flat", "luna", "mars", "terra", "sol", "vector-planet"
    ]);
    expect(Object.fromEntries(loopNodeStyles.map((style) => [style, loopNodeStyleCatalog[style]]))).toEqual({
      flat: { label: "Flat", group: "classic" },
      luna: { label: "Luna", group: "classic" },
      mars: { label: "Mars", group: "classic" },
      terra: { label: "Terra", group: "classic" },
      sol: { label: "Sol", group: "classic" },
      "vector-planet": { label: "Vector planet", group: "planet" }
    });
    expect(loopNodeSizeCatalog).toEqual({
      tiny: { label: "Tiny", pixels: 24 },
      small: { label: "Small", pixels: 36 },
      medium: { label: "Medium", pixels: 48 },
      large: { label: "Large", pixels: 64 }
    });
  });

  it("accepts every style and size combination for both inner node roles", () => {
    const base = config();
    const source = base.loops[0]!.nodes[0]!;
    for (const nodeStyle of loopNodeStyles) {
      for (const nodeSize of loopNodeSizes) {
        const node = {
          ...source,
          work: { ...source.work, nodeStyle, nodeSize },
          validation: { ...source.validation, nodeStyle, nodeSize }
        };
        expect(automationConfigSchema.safeParse({
          ...base,
          loops: [{ ...base.loops[0]!, nodes: [node] }]
        }).success, `${nodeStyle}/${nodeSize}`).toBe(true);
      }
    }
  });

  it("rejects removed styles, missing sizes, legacy theme fields, and reserved node ids", () => {
    const base = config();
    const source = base.loops[0]!.nodes[0]!;
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0]!, nodes: [{
        ...source,
        work: { ...source.work, nodeStyle: "black-hole" }
      }] }]
    }).success).toBe(false);

    const workWithoutSize: Record<string, unknown> = { ...source.work };
    delete workWithoutSize.nodeSize;
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0]!, theme: "legacy", nodes: [{ ...source, work: workWithoutSize }] }]
    }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0]!, startNodeId: "completed", nodes: [{ ...source, id: "completed" }] }]
    }).success).toBe(false);
  });
});
