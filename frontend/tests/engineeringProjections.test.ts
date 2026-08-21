import { describe, expect, it } from "vitest";
import {
  defaultLoopTheme,
  type InstalledLoopModuleStatus,
  type LoopRunDetails,
  type OrchestratorRoute,
  type ProjectAutomationConfig,
  type RootRun
} from "@shared/api/workspace-contracts";
import {
  calculateGraphEngineeringLayout,
  type GraphEngineeringLayoutNode
} from "../src/workspace/automation/loops/graphEngineeringLayout";
import {
  buildGraphEngineeringFocus,
  buildGraphEngineeringProjection,
  buildWorkflowEngineeringProjection
} from "../src/workspace/automation/loops/engineeringProjections";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

describe("Graph and Workflow Engineering projections", () => {
  it("projects one compact Loop card per Loop and keeps transitions separate from repairs", () => {
    const first = workflowLoop("first-loop");
    const second = workflowLoop("second-loop");
    const config = workflowAutomation(first, second);
    config.graph.transitions = [
      transition("forward", first.id, "PASS", "success", second.id),
      transition("back", second.id, "FAIL", "invalid_plan", first.id),
      transition("complete", second.id, "PASS", "complete", "DONE")
    ];
    config.graph.repairEdges = [{
      id: "repair", source: second.id, target: first.id,
      capability: "test:loop.transfer", description: "Repair through the explicit allowlist."
    }];

    const projection = buildGraphEngineeringProjection({ config, installedModules: [installed(second.id)] });

    expect(projection.nodes).toHaveLength(2);
    expect(projection.nodes[1]).toMatchObject({ title: "Sample module", kind: "installed", jobCount: 1 });
    expect(projection.edges.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: "forward", kind: "transition" },
      { id: "back", kind: "transition" },
      { id: "complete", kind: "transition" },
      { id: "repair", kind: "repair" }
    ]);
    expect(projection.done).toBe(true);
    expect(JSON.stringify(projection.nodes)).not.toContain("job-validation");
  });

  it.each([1, 5, 40])("lays out %i Loops deterministically without card overlap", (count) => {
    const loops = Array.from({ length: count }, (_, index) => workflowLoop(`loop-${index + 1}`));
    const projection = buildGraphEngineeringProjection({ config: workflowAutomation(...loops) });
    const first = calculateGraphEngineeringLayout(projection);
    const repeated = calculateGraphEngineeringLayout(projection);

    expect(repeated).toEqual(first);
    expect(first.filter(({ kind }) => kind === "loop")).toHaveLength(count);
    expect(first[0]).toMatchObject({ id: "loop-orchestrator", kind: "orchestrator", x: 48, y: 40 });
    expect(noOverlappingLoops(first)).toBe(true);
    expect(first.filter(({ kind }) => kind !== "orchestrator")
      .every(({ x, y }) => x % 24 === 0 && y % 24 === 0)).toBe(true);
  });

  it("reports explicit transition and repair counts without hiding routes", () => {
    const config = workflowAutomation(workflowLoop("first-loop"), workflowLoop("second-loop"));
    config.graph.repairEdges = [{
      id: "repair", source: "second-loop", target: "first-loop",
      capability: "test:loop.transfer", description: "Repair."
    }];
    const focus = buildGraphEngineeringFocus(buildGraphEngineeringProjection({ config }));
    expect(focus.transitionCount).toBe(config.graph.transitions.length);
    expect(focus.repairCount).toBe(1);
    expect(focus.edges).toHaveLength(config.graph.transitions.length + 1);
  });

  it("projects Workflow Engineering from only the selected Loop", () => {
    const first = workflowLoop("first-loop");
    const second = workflowLoop("second-loop");
    const config = workflowAutomation(first, second);
    const projection = buildWorkflowEngineeringProjection(config, second.id);

    expect(projection).toMatchObject({ startJobNodeId: "job" });
    expect(projection?.jobNodes.map(({ id }) => id)).toEqual(["job"]);
    expect(projection?.validationNodes.map(({ id }) => id)).toEqual(["job-validation"]);
    expect(JSON.stringify(projection)).not.toContain(first.id);
    expect(buildWorkflowEngineeringProjection(config, "missing-loop")).toBeUndefined();
  });

  it("marks only an immutable-snapshot-authorized active repair route", () => {
    const source = workflowLoop("source-loop");
    const target = workflowLoop("target-loop");
    const config = workflowAutomation(source, target);
    config.graph.repairEdges = [{
      id: "repair-route", source: source.id, target: target.id,
      capability: "test:loop.transfer", description: "Repair missing evidence."
    }];
    const root = activeRoot(config);
    const route = repairRoute("repair-route", source.id, target.id);

    const projection = buildGraphEngineeringProjection({
      config,
      activeRootRuns: [root],
      loopRuns: [liveRepairRun(target, route)],
      orchestratorRoutes: [route]
    });

    expect(projection.edges.find(({ id }) => id === route.loopEdgeId)?.activeRoute).toEqual(route);
    expect(projection.routeEvidence).toEqual([{ route, state: "active" }]);
  });

  it("blocks forged and capability-mismatched repair evidence", () => {
    const source = workflowLoop("source-loop");
    const target = workflowLoop("target-loop");
    const config = workflowAutomation(source, target);
    config.graph.repairEdges = [{
      id: "repair-route", source: source.id, target: target.id,
      capability: "test:loop.transfer", description: "Repair missing evidence."
    }];
    const root = activeRoot(config);
    root.executionSnapshot.loops[1]!.capabilities.provides = [];
    const mismatched = repairRoute("repair-route", source.id, target.id);
    const outside = repairRoute("not-allowed", source.id, target.id, "outside-route");

    const projection = buildGraphEngineeringProjection({
      config,
      activeRootRuns: [root],
      loopRuns: [liveRepairRun(target, mismatched)],
      orchestratorRoutes: [mismatched, outside]
    });

    expect(projection.edges.find(({ id }) => id === "repair-route")?.activeRoute).toBeUndefined();
    expect(projection.routeEvidence.map(({ state }) => state)).toEqual(["blocked", "blocked"]);
    expect(projection.routeEvidence[0]?.reason).toContain("does not provide repair capability");
    expect(projection.routeEvidence[1]?.reason).toContain("outside the immutable Root Run repair allowlist");
  });
});

const transition = (
  id: string,
  source: string,
  decision: "PASS" | "FAIL",
  outcome: string,
  target: string
) => ({
  id, source, decision, outcome,
  target: target === "DONE" ? { runResult: "DONE" as const } : { loopId: target },
  description: `${decision} ${outcome}.`
});

const noOverlappingLoops = (nodes: GraphEngineeringLayoutNode[]): boolean => {
  const loops = nodes.filter(({ kind }) => kind === "loop");
  return loops.every((left, index) => loops.slice(index + 1).every((right) =>
    left.x + left.width <= right.x || right.x + right.width <= left.x
    || left.y + left.height <= right.y || right.y + right.height <= left.y));
};

function activeRoot(config: ProjectAutomationConfig): RootRun {
  return {
    rootRunId: "root-run", kind: "loop", targetId: config.loops[0]!.id, source: "manual", status: "running",
    stateRevision: 0, worktreePath: "/tmp/worktree", branch: "codex/test", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64), transitionCount: 1,
    executionSnapshot: {
      version: 6, rootKind: "loop", rootLoopId: config.loops[0]!.id,
      project: { checkoutRoot: "/tmp/worktree", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
      orchestrator: structuredClone(config.orchestrator),
      issueTracker: {
        kind: "tk", testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
        orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
      },
      graph: structuredClone(config.graph), loops: structuredClone(config.loops),
      theme: structuredClone(defaultLoopTheme), executionProfiles: [], runtimes: [], resources: [],
      createdAt: "2026-08-20T08:00:00.000Z"
    },
    createdAt: "2026-08-20T08:00:00.000Z", updatedAt: "2026-08-20T08:00:01.000Z"
  };
}

function repairRoute(
  loopEdgeId: string,
  sourceLoopId: string,
  targetLoopId: string,
  routeId = "route"
): OrchestratorRoute {
  return {
    routeId, rootRunId: "root-run", orchestrationRequestId: "request", kind: "repair",
    orchestratorNodeRunId: "orchestrator-node", loopEdgeId, sourceLoopId, targetLoopId,
    createdAt: "2026-08-20T08:00:01.000Z"
  };
}

function liveRepairRun(loop: ReturnType<typeof workflowLoop>, route: OrchestratorRoute): LoopRunDetails {
  return {
    loopRunId: "target-loop-run", loopId: loop.id, rootRunId: route.rootRunId, source: "repair",
    status: "running", snapshot: structuredClone(loop), themeSnapshot: structuredClone(defaultLoopTheme),
    orchestrationRequestId: route.orchestrationRequestId, entryStateRevision: 0, nestingDepth: 1,
    createdAt: "2026-08-20T08:00:01.000Z", updatedAt: "2026-08-20T08:00:02.000Z",
    jobRuns: [], nodeRuns: []
  };
}

function installed(loopId: string): InstalledLoopModuleStatus {
  return {
    moduleId: "sample-module", moduleVersion: "1.0.0", title: "Sample module",
    source: "project-library:sample", packageSha256: "a".repeat(64), loopId,
    installedAt: "2026-08-16T00:00:00.000Z", profileMappings: {},
    idRemapping: { loop: {}, nodes: {}, edges: {}, instructions: {}, skills: {} },
    stateContract: { id: "sample", version: "1.0.0", description: "Sample.", initial: {}, requiredKeys: [] },
    capabilities: {
      requires: [], accepts: ["software:sample.requested"], provides: ["software:sample.delivered"],
      recommendedTransitions: [], recommendedRepairs: []
    },
    ownedResources: [], installedContentSha256: "b".repeat(64), status: "exact",
    currentContentSha256: "b".repeat(64), missingResources: []
  };
}
