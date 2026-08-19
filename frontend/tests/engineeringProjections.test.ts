import { describe, expect, it } from "vitest";
import type { InstalledLoopModuleStatus } from "@shared/api/workspace-contracts";
import { calculateGraphEngineeringLayout } from "../src/workspace/automation/loops/graphEngineeringLayout";
import {
  buildGraphEngineeringFocus,
  buildGraphEngineeringProjection,
  buildLoopEngineeringProjection
} from "../src/workspace/automation/loops/engineeringProjections";
import { v11Automation, v11Loop } from "./v11Fixtures";

describe("Graph and Loop Engineering projections", () => {
  it("projects exactly one Graph Engineering black box per Loop and only ProjectLoopEdges, including cycles", () => {
    const first = v11Loop("first-loop");
    const second = v11Loop("second-loop");
    const config = v11Automation(first, second);
    config.graph.loopEdges = [
      { id: "forward", source: first.id, target: second.id, kind: "flow", capability: "test:loop.transfer", description: "Forward." },
      { id: "back", source: second.id, target: first.id, kind: "repair", capability: "test:loop.transfer", description: "Back." }
    ];
    const projection = buildGraphEngineeringProjection({ config, installedModules: [installed(second.id)] });
    const firstLayout = calculateGraphEngineeringLayout(projection);
    expect(calculateGraphEngineeringLayout(projection)).toEqual(firstLayout);
    expect(new Set(firstLayout.map(({ x, y }) => `${x}:${y}`))).toHaveLength(2);
    expect(projection.nodes).toHaveLength(2);
    expect(projection.nodes[1]).toMatchObject({ title: "Sample module", loopId: second.id, kind: "installed", workLoopNodeCount: 1 });
    expect(projection.edges.map(({ id, kind }) => ({ id, kind }))).toEqual([{ id: "forward", kind: "flow" }, { id: "back", kind: "repair" }]);
    expect(projection.nodes[0]).not.toHaveProperty("nodes");
  });

  it("uses a deterministic three-column snake so larger Loop systems remain legible", () => {
    const loops = Array.from({ length: 8 }, (_, index) => v11Loop(`loop-${index + 1}`));
    const projection = buildGraphEngineeringProjection({ config: v11Automation(...loops) });
    const layout = calculateGraphEngineeringLayout(projection);

    expect(new Set(layout.map(({ y }) => y))).toHaveLength(3);
    expect(layout.slice(0, 3).map(({ x }) => x)).toEqual([48, 336, 624]);
    expect(layout.slice(3, 6).map(({ x }) => x)).toEqual([624, 336, 48]);
    expect(layout.slice(6).map(({ x }) => x)).toEqual([48, 336]);
  });

  it("keeps every flow route but focuses repair routes on the selected Loop", () => {
    const first = v11Loop("first-loop");
    const second = v11Loop("second-loop");
    const third = v11Loop("third-loop");
    const config = v11Automation(first, second, third);
    config.graph.loopEdges = [
      { id: "flow", source: first.id, target: second.id, kind: "flow", capability: "test:loop.transfer", description: "Continue." },
      { id: "selected-repair", source: third.id, target: second.id, kind: "repair", capability: "test:loop.transfer", description: "Repair selected." },
      { id: "hidden-repair", source: first.id, target: third.id, kind: "repair", capability: "test:loop.transfer", description: "Repair elsewhere." }
    ];
    const projection = buildGraphEngineeringProjection({ config });

    expect(buildGraphEngineeringFocus(projection, second.id)).toEqual({
      edges: [config.graph.loopEdges[0], config.graph.loopEdges[1]],
      visibleRepairCount: 1,
      hiddenRepairCount: 1
    });
    expect(buildGraphEngineeringFocus(projection)).toEqual({
      edges: [config.graph.loopEdges[0]],
      visibleRepairCount: 0,
      hiddenRepairCount: 2
    });
  });

  it("projects Loop Engineering from only the selected Loop and reports unknown ids", () => {
    const first = v11Loop("first-loop");
    const second = v11Loop("second-loop");
    second.nodes[0] = { ...second.nodes[0]!, id: "second-work" };
    second.startNodeId = "second-work";
    second.edges[0] = { ...second.edges[0]!, source: "second-work", target: { terminal: "failed" } };
    const config = v11Automation(first, second);
    config.graph.loopEdges = [{ id: "global", source: first.id, target: second.id, kind: "flow", capability: "test:loop.transfer", description: "Global." }];

    const projection = buildLoopEngineeringProjection(config, second.id);
    expect(projection).toMatchObject({ startNodeId: "second-work", terminals: ["failed"] });
    expect(projection?.nodes.map((node) => node.id)).toEqual(["second-work"]);
    expect(projection?.edges.map((edge) => edge.id)).toEqual([second.edges[0]?.id]);
    expect(JSON.stringify(projection)).not.toContain(first.id);
    expect(JSON.stringify(projection)).not.toContain("global");
    expect(buildLoopEngineeringProjection(config, "missing-loop")).toBeUndefined();
  });
});

function installed(loopId: string): InstalledLoopModuleStatus {
  return {
    moduleId: "sample-module",
    moduleVersion: "1.0.0",
    title: "Sample module",
    source: "project-library:sample",
    packageSha256: "a".repeat(64),
    loopId,
    installedAt: "2026-08-16T00:00:00.000Z",
    profileMappings: {},
    idRemapping: { loop: {}, nodes: {}, edges: {}, instructions: {}, skills: {} },
    stateContract: { id: "sample", version: "1.0.0", description: "Sample.", initial: {}, requiredKeys: [] },
    capabilities: {
      requires: [], accepts: ["software:sample.requested"],
      provides: ["software:sample.delivered"], recommendedConnections: []
    },
    ownedResources: [],
    installedContentSha256: "b".repeat(64),
    status: "exact",
    currentContentSha256: "b".repeat(64),
    missingResources: []
  };
}
