import { describe, expect, it } from "vitest";
import type { ProjectSspGraphStrategyV1 } from "../../shared/domain/decisionModel.js";
import { derivePolicyProjection } from "./PolicyProjection.js";

describe("bounded derived Policy Projection", () => {
  it("uses arbitrary GraphNode actions, exposes configured branches, and cuts cycles", () => {
    const projection = derivePolicyProjection({
      strategy: strategy(),
      currentStateId: "open",
      snapshotGraphNodeIds: ["intake", "threat-model", "implement", "benchmark", "ship"],
      modelSha256: "model-hash",
      source: "run_snapshot"
    });

    expect(projection.derived).toBe(true);
    expect(projection.nodes[0]).toMatchObject({ stateId: "open", selectedGraphNodeId: "intake" });
    expect(projection.edges.some(({ probabilityPpm }) => probabilityPpm === 200_000)).toBe(true);
    expect(projection.nodes.some(({ cutoff }) => cutoff === "cycle")).toBe(true);
    expect(projection.nodes.length).toBeLessThanOrEqual(20);
  });

  it("honors configured projection node bounds without creating control state", () => {
    const bounded = strategy();
    bounded.model.projection.maxProjectionNodes = 2;
    const projection = derivePolicyProjection({
      strategy: bounded,
      currentStateId: "open",
      snapshotGraphNodeIds: bounded.capabilityGraph.actions.map(({ graphNodeId }) => graphNodeId),
      modelSha256: "model-hash",
      source: "configure_draft"
    });
    expect(projection.nodes).toHaveLength(2);
    expect(projection.truncated).toBe(true);
    expect(projection.source).toBe("configure_draft");
  });
});

const strategy = (): ProjectSspGraphStrategyV1 => ({
  kind: "ssp_v1", id: "generic-policy", description: "Unrelated capability policy.", nodeStyle: "luna", nodeSize: "medium",
  capabilityGraph: { version: 1, actions: ["intake", "threat-model", "implement", "benchmark", "ship"].map((graphNodeId) => ({ graphNodeId, guards: [] })) },
  model: {
    version: 1,
    features: [{ id: "phase", domain: ["open", "checked", "done", "failed", "blocked"], missingValue: "open", source: { kind: "project_state", pointer: "/phase" } }],
    states: [
      { id: "open", values: { phase: "open" } },
      { id: "checked", values: { phase: "checked" } },
      { id: "success", values: { phase: "done" }, terminal: "success" },
      { id: "failure", values: { phase: "failed" }, terminal: "failure" },
      { id: "blocked", values: { phase: "blocked" }, terminal: "blocked" }
    ],
    stateActions: [
      { stateId: "open", graphNodeId: "intake", expectedCostMicros: 2_000_000, successors: [{ nextStateId: "checked", probabilityPpm: 800_000 }, { nextStateId: "open", probabilityPpm: 200_000 }] },
      { stateId: "checked", graphNodeId: "ship", expectedCostMicros: 1_000_000, successors: [{ nextStateId: "success", probabilityPpm: 1_000_000 }] }
    ],
    solver: { algorithm: "ssp_value_iteration_v1", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
    projection: { maxDecisionEpochs: 20, maxProjectionNodes: 20 }
  }
});
