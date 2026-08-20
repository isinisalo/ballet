import { describe, expect, it } from "vitest";
import {
  defaultLoopTheme,
  type InstalledLoopModuleStatus,
  type LoopRunDetails,
  type OrchestratorRoute,
  type ProjectAutomationConfig,
  type RootRun
} from "@shared/api/workspace-contracts";
import { calculateGraphEngineeringLayout } from "../src/workspace/automation/loops/graphEngineeringLayout";
import {
  buildGraphEngineeringFocus,
  buildGraphEngineeringProjection,
  buildWorkflowEngineeringProjection
} from "../src/workspace/automation/loops/engineeringProjections";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

describe("Graph and Workflow Engineering projections", () => {
  it("projects exactly one Graph Engineering black box per Loop and only ProjectLoopEdges, including cycles", () => {
    const first = workflowLoop("first-loop");
    const second = workflowLoop("second-loop");
    const config = workflowAutomation(first, second);
    config.graph.loopEdges = [
      { id: "forward", source: first.id, target: second.id, kind: "flow", capability: "test:loop.transfer", description: "Forward." },
      { id: "back", source: second.id, target: first.id, kind: "repair", capability: "test:loop.transfer", description: "Back." }
    ];
    const projection = buildGraphEngineeringProjection({ config, installedModules: [installed(second.id)] });
    const firstLayout = calculateGraphEngineeringLayout(projection);
    expect(calculateGraphEngineeringLayout(projection)).toEqual(firstLayout);
    expect(new Set(firstLayout.map(({ x, y }) => `${x}:${y}`))).toHaveLength(3);
    expect(projection.nodes).toHaveLength(2);
    expect(projection.orchestrator).toMatchObject({ id: "loop-orchestrator", title: "Loop Orchestrator" });
    expect(projection.nodes[1]).toMatchObject({ title: "Sample module", loopId: second.id, kind: "installed", jobCount: 1 });
    expect(projection.edges.map(({ id, kind }) => ({ id, kind }))).toEqual([{ id: "forward", kind: "flow" }, { id: "back", kind: "repair" }]);
    expect(projection.nodes[0]).not.toHaveProperty("nodes");
    expect(JSON.stringify(projection.nodes)).not.toContain("Execute work.");
  });

  it("uses a deterministic three-column snake so larger Loop systems remain legible", () => {
    const loops = Array.from({ length: 8 }, (_, index) => workflowLoop(`loop-${index + 1}`));
    const projection = buildGraphEngineeringProjection({ config: workflowAutomation(...loops) });
    const layout = calculateGraphEngineeringLayout(projection);

    expect(layout).toHaveLength(9);
    expect(layout[0]).toMatchObject({ id: "loop-orchestrator", kind: "orchestrator", x: 360, y: 240 });
    expect(layout.slice(1).map(({ x, y }) => [x, y])).toEqual([
      [48, 240], [672, 240], [48, 48], [672, 48], [48, 432], [672, 432], [360, 48], [360, 432]
    ]);
    expect(layout.every(({ x, y }) => x % 24 === 0 && y % 24 === 0)).toBe(true);
  });

  it("keeps every flow route but focuses repair routes on the selected Loop", () => {
    const first = workflowLoop("first-loop");
    const second = workflowLoop("second-loop");
    const third = workflowLoop("third-loop");
    const config = workflowAutomation(first, second, third);
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

  it("projects Workflow Engineering from only the selected Loop and reports unknown ids", () => {
    const first = workflowLoop("first-loop");
    const second = workflowLoop("second-loop");
    const config = workflowAutomation(first, second);
    config.graph.loopEdges = [{ id: "global", source: first.id, target: second.id, kind: "flow", capability: "test:loop.transfer", description: "Global." }];

    const projection = buildWorkflowEngineeringProjection(config, second.id);
    expect(projection).toMatchObject({ startJobNodeId: "job" });
    expect(projection?.jobNodes.map((node) => node.id)).toEqual(["job"]);
    expect(projection?.validationNodes.map((node) => node.id)).toEqual(["job-validation"]);
    expect(projection?.passEdges.map((edge) => edge.id)).toEqual([second.workflow.passEdges[0]?.id]);
    expect(projection?.failEdges.map((edge) => edge.id)).toEqual([second.workflow.failEdges[0]?.id]);
    expect(JSON.stringify(projection)).not.toContain(first.id);
    expect(JSON.stringify(projection)).not.toContain("global");
    expect(buildWorkflowEngineeringProjection(config, "missing-loop")).toBeUndefined();
  });

  it("highlights only a canonical persisted route accepted by the active immutable snapshot", () => {
    const source = workflowLoop("source-loop");
    const target = workflowLoop("target-loop");
    const config = workflowAutomation(source, target);
    const edge = { id: "flow-route", source: source.id, target: target.id, kind: "flow" as const, capability: "test:loop.transfer", description: "Dispatch completed work." };
    config.graph.loopEdges = [edge];
    const root = activeRoot(config);
    const route = orchestratorRoute(edge.id, source.id, target.id);
    const targetRun = liveTargetRun(target, route);

    const projection = buildGraphEngineeringProjection({
      config,
      activeRootRuns: [root],
      loopRuns: [targetRun],
      orchestratorRoutes: [route]
    });

    expect(projection.edges[0]?.activeRoute).toEqual(route);
    expect(projection.routeEvidence).toEqual([{ route, state: "active" }]);
    expect(projection.nodes.find(({ loopId }) => loopId === target.id)?.liveStatus).toBe("running");
  });

  it("reports out-of-allowlist and capability-mismatched route evidence as blocked, never active", () => {
    const source = workflowLoop("source-loop");
    const target = workflowLoop("target-loop");
    const config = workflowAutomation(source, target);
    const allowed = { id: "repair-route", source: source.id, target: target.id, kind: "repair" as const, capability: "test:loop.transfer", description: "Repair missing evidence." };
    config.graph.loopEdges = [allowed];
    const root = activeRoot(config);
    root.executionSnapshot.loops[1]!.capabilities.provides = [];
    const mismatched = orchestratorRoute(allowed.id, source.id, target.id, "repair");
    const outside = orchestratorRoute("not-allowed", source.id, target.id, "repair", "outside-route");

    const projection = buildGraphEngineeringProjection({
      config,
      activeRootRuns: [root],
      loopRuns: [liveTargetRun(target, mismatched)],
      orchestratorRoutes: [mismatched, outside]
    });

    expect(projection.edges[0]?.activeRoute).toBeUndefined();
    expect(projection.routeEvidence.map(({ state }) => state)).toEqual(["blocked", "blocked"]);
    expect(projection.routeEvidence[0]?.reason).toContain("does not satisfy repair capability");
    expect(projection.routeEvidence[1]?.reason).toContain("outside the immutable Root Run graph allowlist");
  });
});

function activeRoot(config: ProjectAutomationConfig): RootRun {
  return {
    rootRunId: "root-run", kind: "loop", targetId: config.loops[0]!.id, source: "manual", status: "running",
    stateRevision: 0, worktreePath: "/tmp/worktree", branch: "codex/test", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64), transitionCount: 1,
    executionSnapshot: {
      version: 5, rootLoopId: config.loops[0]!.id,
      project: { checkoutRoot: "/tmp/worktree", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
      orchestrator: structuredClone(config.orchestrator), graph: structuredClone(config.graph), loops: structuredClone(config.loops),
      theme: structuredClone(defaultLoopTheme), executionProfiles: [], runtimes: [], resources: [],
      createdAt: "2026-08-20T08:00:00.000Z"
    },
    createdAt: "2026-08-20T08:00:00.000Z", updatedAt: "2026-08-20T08:00:01.000Z"
  };
}

function orchestratorRoute(
  loopEdgeId: string,
  sourceLoopId: string,
  targetLoopId: string,
  kind: "flow" | "repair" = "flow",
  routeId = "route"
): OrchestratorRoute {
  return {
    routeId, rootRunId: "root-run", orchestrationRequestId: "request", kind,
    orchestratorNodeRunId: "orchestrator-node", loopEdgeId, sourceLoopId, targetLoopId,
    createdAt: "2026-08-20T08:00:01.000Z"
  };
}

function liveTargetRun(loop: ReturnType<typeof workflowLoop>, route: OrchestratorRoute): LoopRunDetails {
  return {
    loopRunId: "target-loop-run", loopId: loop.id, rootRunId: route.rootRunId, source: route.kind,
    status: "running", snapshot: structuredClone(loop), themeSnapshot: structuredClone(defaultLoopTheme),
    orchestrationRequestId: route.orchestrationRequestId, entryStateRevision: 0, nestingDepth: route.kind === "repair" ? 1 : 0,
    createdAt: "2026-08-20T08:00:01.000Z", updatedAt: "2026-08-20T08:00:02.000Z", jobRuns: [], nodeRuns: []
  };
}

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
