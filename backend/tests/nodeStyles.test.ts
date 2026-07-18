import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  defaultHumanStepTransitions,
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
      on: defaultHumanStepTransitions()
    }, ...defaultTerminalNodes()]
  }]
});

describe("v8 node style and size catalogs", () => {
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

  it("accepts every one of the 6 × 4 style and size combinations", () => {
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
});

describe("v8 node style and terminal validation", () => {
  it("rejects removed node styles and the removed Loop summary field", () => {
    const base = config();
    const removedStyles = [
      "black-hole", "meteorite", "black-planet", "fire-planet", "shattered-planet",
      "satellite", "spaceman", "black-ice-planet", "battle-station",
      "ship-arrow", "ship-fang", "ship-crescent", "ship-twin-pod", "ship-needle", "ship-hammer",
      "monster-void-eye", "monster-star-jelly", "monster-void-manta", "monster-cosmic-serpent",
      "monster-moon-maw", "monster-astral-kraken"
    ];
    removedStyles.forEach((nodeStyle) => {
      expect(automationConfigSchema.safeParse({
        ...base,
        loops: [{
          ...base.loops[0],
          nodes: base.loops[0]!.nodes.map((node) => ({ ...node, nodeStyle }))
        }]
      }).success, nodeStyle).toBe(false);
    });
    expect(automationConfigSchema.safeParse({
      ...base,
      loops: [{ ...base.loops[0], summaryStyle: "route" }]
    }).success).toBe(false);
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

  it("provides explicit generic actions for human defaults", () => {
    expect(defaultHumanStepTransitions()).toEqual({
      approved: { action: "goto", target: "completed", input: "append-signal" },
      rejected: { action: "goto", target: "blocked", input: "append-signal" }
    });
  });
});
