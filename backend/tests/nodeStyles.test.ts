import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  defaultTransitionFor,
  defaultTerminalNodes,
  loopNodeSizeCatalog,
  loopNodeSizes,
  loopNodeStyleCatalog,
  loopNodeStyles,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";

const config = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "delivery",
    start: "gate",
    nodes: [{
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeStyle: "flat",
      nodeSize: "medium",
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }]
});

describe("v8 node style and size catalogs", () => {
  it("defines nine independent styles and four explicit sizes", () => {
    expect(loopNodeStyles).toEqual([
      "flat", "luna", "black-hole", "satellite", "meteorite", "spaceman", "mars", "terra", "sol"
    ]);
    expect(Object.fromEntries(loopNodeStyles.map((style) => [style, loopNodeStyleCatalog[style]]))).toEqual({
      flat: { label: "Flat" },
      luna: { label: "Luna" },
      "black-hole": { label: "Black hole" },
      satellite: { label: "Satellite" },
      meteorite: { label: "Meteorite" },
      spaceman: { label: "Spaceman" },
      mars: { label: "Mars" },
      terra: { label: "Terra" },
      sol: { label: "Sol" }
    });
    expect(loopNodeSizeCatalog).toEqual({
      tiny: { label: "Tiny", pixels: 24 },
      small: { label: "Small", pixels: 36 },
      medium: { label: "Medium", pixels: 48 },
      large: { label: "Large", pixels: 64 }
    });
  });

  it("accepts every one of the 9 × 4 style and size combinations", () => {
    const base = config();
    for (const nodeStyle of loopNodeStyles) {
      for (const nodeSize of loopNodeSizes) {
        expect(automationConfigSchema.safeParse({
          ...base,
          loops: [{
            ...base.loops[0],
            nodes: base.loops[0]!.nodes.map((node) => ({ ...node, nodeStyle, nodeSize }))
          }]
        }).success, `${nodeStyle}/${nodeSize}`).toBe(true);
      }
    }
  });

  it("requires nodeSize and rejects legacy loop theme fields", () => {
    const base = config();
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], theme: "legacy" }]
    }).success).toBe(false);
    const withoutNodeSize: Record<string, unknown> = { ...base.loops[0]!.nodes[0]! };
    delete withoutNodeSize.nodeSize;
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{
        ...base.loops[0],
        nodes: [withoutNodeSize, ...base.loops[0]!.nodes.slice(1)]
      }]
    }).success).toBe(false);
  });

  it("requires exactly one fixed-id terminal node of every status", () => {
    const base = config();
    const nodes = base.loops[0]!.nodes;
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], nodes: nodes.filter((node) => node.id !== "failed") }]
    }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], nodes: [...nodes, { ...nodes.find((node) => node.id === "completed")! }] }]
    }).success).toBe(false);
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], nodes: nodes.map((node) => node.id === "completed" ? { ...node, id: "blocked" } : node) }]
    }).success).toBe(false);
  });

  it("reserves terminal ids and forbids agent, schedule, and output fields on terminals", () => {
    const base = config();
    const executable = base.loops[0]!.nodes[0]!;
    const terminals = defaultTerminalNodes();
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], start: "completed", nodes: [{ ...executable, id: "completed" }, ...terminals] }]
    }).success).toBe(false);
    for (const forbidden of [
      { agentId: "agent" },
      { schedule: { kind: "once", date: "2026-07-14", time: "09:00", timeZone: "UTC" } },
      { on: { approved: "completed", rejected: "blocked" } }
    ]) {
      expect(automationConfigSchema.safeParse({
        ...base,
        loops: [{
          ...base.loops[0],
          nodes: base.loops[0]!.nodes.map((node) => node.id === "completed" ? { ...node, ...forbidden } : node)
        }]
      }).success).toBe(false);
    }
  });

  it("provides completed and blocked defaults for required outputs", () => {
    expect(defaultTransitionFor("approved")).toBe("completed");
    expect(defaultTransitionFor("rejected")).toBe("blocked");
  });
});
