import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  defaultTransitionFor,
  defaultTerminalNodes,
  loopNodeSizeCatalog,
  loopNodeSizes,
  loopNodeStyleCatalog,
  loopNodeStyles,
  loopSummaryStyleCatalog,
  loopSummaryStyles,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";

const config = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "delivery",
    start: "gate",
    summaryStyle: "route",
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
  it("defines 27 ordered styles with group and border metadata and four explicit sizes", () => {
    expect(loopNodeStyles).toEqual([
      "flat", "luna", "black-hole", "satellite", "meteorite", "spaceman", "mars", "terra", "sol",
      "black-ice-planet", "black-planet", "fire-planet", "shattered-planet", "vector-planet", "battle-station",
      "ship-arrow", "ship-fang", "ship-crescent", "ship-twin-pod", "ship-needle", "ship-hammer",
      "monster-void-eye", "monster-star-jelly", "monster-void-manta", "monster-cosmic-serpent",
      "monster-moon-maw", "monster-astral-kraken"
    ]);
    expect(Object.fromEntries(loopNodeStyles.map((style) => [style, loopNodeStyleCatalog[style]]))).toEqual({
      flat: { label: "Flat", group: "classic", borderless: false },
      luna: { label: "Luna", group: "classic", borderless: false },
      "black-hole": { label: "Black hole", group: "classic", borderless: true },
      satellite: { label: "Satellite", group: "classic", borderless: true },
      meteorite: { label: "Meteorite", group: "classic", borderless: true },
      spaceman: { label: "Spaceman", group: "classic", borderless: false },
      mars: { label: "Mars", group: "classic", borderless: false },
      terra: { label: "Terra", group: "classic", borderless: false },
      sol: { label: "Sol", group: "classic", borderless: false },
      "black-ice-planet": { label: "Black ice planet", group: "planet", borderless: false },
      "black-planet": { label: "Black planet", group: "planet", borderless: false },
      "fire-planet": { label: "Fire planet", group: "planet", borderless: false },
      "shattered-planet": { label: "Shattered planet", group: "planet", borderless: true },
      "vector-planet": { label: "Vector planet", group: "planet", borderless: false },
      "battle-station": { label: "Battle station", group: "planet", borderless: false },
      "ship-arrow": { label: "Arrow scout", group: "ship", borderless: true },
      "ship-fang": { label: "Fang interceptor", group: "ship", borderless: true },
      "ship-crescent": { label: "Crescent courier", group: "ship", borderless: true },
      "ship-twin-pod": { label: "Twin-pod bomber", group: "ship", borderless: true },
      "ship-needle": { label: "Needle frigate", group: "ship", borderless: true },
      "ship-hammer": { label: "Hammer cruiser", group: "ship", borderless: true },
      "monster-void-eye": { label: "Void eye", group: "monster", borderless: true },
      "monster-star-jelly": { label: "Star jelly", group: "monster", borderless: true },
      "monster-void-manta": { label: "Void manta", group: "monster", borderless: true },
      "monster-cosmic-serpent": { label: "Cosmic serpent", group: "monster", borderless: true },
      "monster-moon-maw": { label: "Moon maw", group: "monster", borderless: true },
      "monster-astral-kraken": { label: "Astral kraken", group: "monster", borderless: true }
    });
    expect(loopNodeSizeCatalog).toEqual({
      tiny: { label: "Tiny", pixels: 24 },
      small: { label: "Small", pixels: 36 },
      medium: { label: "Medium", pixels: 48 },
      large: { label: "Large", pixels: 64 }
    });
  });

  it("accepts every one of the 27 × 4 style and size combinations", () => {
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

  it("defines seven Loop summary styles and defaults legacy v8 Loops to Route", () => {
    expect(loopSummaryStyles).toEqual([
      "route", "spiral", "barred-spiral", "ring", "edge-on", "twin-core", "irregular-nebula"
    ]);
    expect(loopSummaryStyleCatalog).toEqual({
      route: { label: "Route" },
      spiral: { label: "Spiral" },
      "barred-spiral": { label: "Barred spiral" },
      ring: { label: "Ring" },
      "edge-on": { label: "Edge-on" },
      "twin-core": { label: "Twin core" },
      "irregular-nebula": { label: "Irregular nebula" }
    });

    const legacyLoop = { ...config().loops[0] } as Record<string, unknown>;
    delete legacyLoop.summaryStyle;
    const parsed = automationConfigSchema.parse({ version: 8, loops: [legacyLoop] });
    expect(parsed.loops[0]?.summaryStyle).toBe("route");
    expect(automationConfigSchema.safeParse({
      ...config(),
      loops: [{ ...config().loops[0], summaryStyle: "unknown-galaxy" }]
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

  it("provides completed and blocked defaults for required outputs", () => {
    expect(defaultTransitionFor("approved")).toBe("completed");
    expect(defaultTransitionFor("rejected")).toBe("blocked");
  });
});
