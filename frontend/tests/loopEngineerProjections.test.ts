import { describe, expect, it } from "vitest";
import type { InstalledLoopModuleStatus } from "@shared/api/workspace-contracts";
import { calculateLoopCompositionLayout } from "../src/workspace/automation/loops/loopCompositionLayout";
import {
  buildLoopCompositionFocus,
  buildLoopCompositionProjection,
  buildLoopContextProjection,
  buildLoopDetailProjection
} from "../src/workspace/automation/loops/loopEngineerProjections";
import { v10Automation, v10Loop } from "./v10Fixtures";

describe("Loop Engineer projections", () => {
  it("derives Context entry, leaf, module outcomes, and counts without Work Loop Nodes", () => {
    const first = v10Loop("first-loop");
    const second = v10Loop("second-loop");
    second.description = "Deliver the reviewed project outcome.";
    const config = v10Automation(first, second);
    config.loopEdges = [
      { id: "first-flow", source: first.id, target: second.id, kind: "flow", description: "Continue." },
      { id: "second-repair", source: second.id, target: first.id, kind: "repair", description: "Repair." }
    ];
    const projection = buildLoopContextProjection({
      project: { name: "Ballet", description: "Coordinate verified Loop work." },
      config,
      installedModules: [installed(second.id)],
      activeLoopIds: new Set([first.id])
    });

    expect(projection.projectIntent).toMatchObject({ name: "Ballet", entryLoopCount: 1, missingDescription: false });
    expect(projection.system).toEqual({ loopCount: 2, installedModuleCount: 1, customLoopCount: 1, flowConnectionCount: 1, repairConnectionCount: 1, activeRunCount: 1 });
    expect(projection.declaredOutcomes).toEqual(["software.sample-delivered", "Sample module"]);
    expect(projection).not.toHaveProperty("nodes");
  });

  it("treats repair as neither incoming flow nor outgoing outcome flow", () => {
    const first = v10Loop("first-loop");
    const second = v10Loop("second-loop");
    const config = v10Automation(first, second);
    config.loopEdges = [{ id: "repair", source: first.id, target: second.id, kind: "repair", description: "Repair." }];
    const projection = buildLoopContextProjection({ project: { name: "Project", description: "" }, config });
    expect(projection.projectIntent).toMatchObject({ entryLoopCount: 2, missingDescription: true });
    expect(projection.declaredOutcomes).toEqual([first.description, second.description]);
  });

  it("projects exactly one Level 1 black box per Loop and only ProjectLoopEdges, including cycles", () => {
    const first = v10Loop("first-loop");
    const second = v10Loop("second-loop");
    const config = v10Automation(first, second);
    config.loopEdges = [
      { id: "forward", source: first.id, target: second.id, kind: "flow", description: "Forward." },
      { id: "back", source: second.id, target: first.id, kind: "repair", description: "Back." }
    ];
    const projection = buildLoopCompositionProjection({ config, installedModules: [installed(second.id)] });
    const firstLayout = calculateLoopCompositionLayout(projection);
    expect(calculateLoopCompositionLayout(projection)).toEqual(firstLayout);
    expect(new Set(firstLayout.map(({ x, y }) => `${x}:${y}`))).toHaveLength(2);
    expect(projection.nodes).toHaveLength(2);
    expect(projection.nodes[1]).toMatchObject({ title: "Sample module", loopId: second.id, kind: "installed", workLoopNodeCount: 1 });
    expect(projection.edges.map(({ id, kind }) => ({ id, kind }))).toEqual([{ id: "forward", kind: "flow" }, { id: "back", kind: "repair" }]);
    expect(projection.nodes[0]).not.toHaveProperty("nodes");
  });

  it("uses a deterministic three-column snake so larger Loop systems remain legible", () => {
    const loops = Array.from({ length: 8 }, (_, index) => v10Loop(`loop-${index + 1}`));
    const projection = buildLoopCompositionProjection({ config: v10Automation(...loops) });
    const layout = calculateLoopCompositionLayout(projection);

    expect(new Set(layout.map(({ y }) => y))).toHaveLength(3);
    expect(layout.slice(0, 3).map(({ x }) => x)).toEqual([48, 336, 624]);
    expect(layout.slice(3, 6).map(({ x }) => x)).toEqual([624, 336, 48]);
    expect(layout.slice(6).map(({ x }) => x)).toEqual([48, 336]);
  });

  it("keeps every flow route but focuses repair routes on the selected Loop", () => {
    const first = v10Loop("first-loop");
    const second = v10Loop("second-loop");
    const third = v10Loop("third-loop");
    const config = v10Automation(first, second, third);
    config.loopEdges = [
      { id: "flow", source: first.id, target: second.id, kind: "flow", description: "Continue." },
      { id: "selected-repair", source: third.id, target: second.id, kind: "repair", description: "Repair selected." },
      { id: "hidden-repair", source: first.id, target: third.id, kind: "repair", description: "Repair elsewhere." }
    ];
    const projection = buildLoopCompositionProjection({ config });

    expect(buildLoopCompositionFocus(projection, second.id)).toEqual({
      edges: [config.loopEdges[0], config.loopEdges[1]],
      visibleRepairCount: 1,
      hiddenRepairCount: 1
    });
    expect(buildLoopCompositionFocus(projection)).toEqual({
      edges: [config.loopEdges[0]],
      visibleRepairCount: 0,
      hiddenRepairCount: 2
    });
  });

  it("projects Level 2 from only the selected Loop and reports unknown ids", () => {
    const first = v10Loop("first-loop");
    const second = v10Loop("second-loop");
    second.nodes[0] = { ...second.nodes[0]!, id: "second-work" };
    second.startNodeId = "second-work";
    second.edges[0] = { ...second.edges[0]!, source: "second-work", target: { terminal: "failed" } };
    const config = v10Automation(first, second);
    config.loopEdges = [{ id: "global", source: first.id, target: second.id, kind: "flow", description: "Global." }];

    const projection = buildLoopDetailProjection(config, second.id);
    expect(projection).toMatchObject({ startNodeId: "second-work", terminals: ["failed"] });
    expect(projection?.nodes.map((node) => node.id)).toEqual(["second-work"]);
    expect(projection?.edges.map((edge) => edge.id)).toEqual([second.edges[0]?.id]);
    expect(JSON.stringify(projection)).not.toContain(first.id);
    expect(JSON.stringify(projection)).not.toContain("global");
    expect(buildLoopDetailProjection(config, "missing-loop")).toBeUndefined();
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
    capabilities: { requires: [], provides: ["software.sample-delivered"], recommendedConnections: [] },
    ownedResources: [],
    installedContentSha256: "b".repeat(64),
    status: "exact",
    currentContentSha256: "b".repeat(64),
    missingResources: []
  };
}
