import { describe, expect, it } from "vitest";
import type { ProjectSspDecisionStrategyV2 } from "../../shared/domain/decisionModel.js";
import { derivePolicyProjection } from "./PolicyProjection.js";

describe("bounded derived Policy Projection v2", () => {
  it("exposes outcome branches, cumulative probability, and cycle cutoffs", () => {
    const projection = derivePolicyProjection({
      strategy: cycleStrategy(), scope: "graph", currentStateId: "open",
      snapshotActionIds: ["intake", "ship"], modelSha256: "model-hash", source: "run_snapshot"
    });
    expect(projection.nodes[0]).toMatchObject({ stateId: "open", selectedActionId: "intake" });
    expect(projection.edges).toContainEqual(expect.objectContaining({ outcomeId: "retry", probabilityPpm: 200_000 }));
    expect(projection.nodes.some(({ cutoff }) => cutoff === "cycle")).toBe(true);
  });

  it("chooses Most Likely Rollout by complete trajectory probability, not greedy local probability", () => {
    const projection = derivePolicyProjection({
      strategy: nonGreedyStrategy(), scope: "graph", currentStateId: "start",
      snapshotActionIds: ["build", "finish-a", "finish-b"], modelSha256: "model-hash", source: "configure_draft"
    });
    const rollout = projection.mostLikelyRolloutNodeIds.map((id) => projection.nodes.find((node) => node.projectionNodeId === id)?.stateId);
    expect(rollout).toEqual(["start", "branch-b", "success"]);
    const leaf = projection.nodes.find(({ projectionNodeId }) => projectionNodeId === projection.mostLikelyRolloutNodeIds.at(-1));
    expect(leaf?.cumulativeProbabilityPpm).toBe(400_000);
  });

  it("honors configured node bounds without creating runtime control state", () => {
    const strategy = cycleStrategy(); strategy.model.projection.maxProjectionNodes = 2;
    const projection = derivePolicyProjection({
      strategy, scope: "graph_node", currentStateId: "open", snapshotActionIds: ["intake", "ship"],
      modelSha256: "model-hash", source: "configure_draft"
    });
    expect(projection.nodes).toHaveLength(2); expect(projection.truncated).toBe(true);
    expect(projection.scope).toBe("graph_node");
  });
});

const base = (actions: string[], outcomes: string[]): Pick<ProjectSspDecisionStrategyV2, "kind" | "id" | "description" | "capabilityModel"> => ({
  kind: "ssp_v2", id: "generic-policy", description: "Generic outcome-aware policy.",
  capabilityModel: { version: 2, outcomes: outcomes.map((id) => ({ id, description: id })), actions: actions.map((actionId) => ({ actionId, guards: [] })) }
});

const cycleStrategy = (): ProjectSspDecisionStrategyV2 => ({
  ...base(["intake", "ship"], ["checked", "retry", "done"]),
  model: {
    version: 2,
    features: [{ id: "phase", domain: ["open", "checked", "done", "failed", "blocked"], missingValue: "open", source: { kind: "project_state", pointer: "/phase" } }],
    states: [
      { id: "open", values: { phase: "open" } }, { id: "checked", values: { phase: "checked" } },
      { id: "success", values: { phase: "done" }, terminal: "success" },
      { id: "failure", values: { phase: "failed" }, terminal: "failure" },
      { id: "blocked", values: { phase: "blocked" }, terminal: "blocked" }
    ],
    stateActions: [
      { stateId: "open", actionId: "intake", expectedCostMicros: 2_000_000, successors: [
        { outcomeId: "checked", expectedNextStateId: "checked", probabilityPpm: 800_000 },
        { outcomeId: "retry", expectedNextStateId: "open", probabilityPpm: 200_000 }
      ] },
      { stateId: "checked", actionId: "ship", expectedCostMicros: 1_000_000, successors: [{ outcomeId: "done", expectedNextStateId: "success", probabilityPpm: 1_000_000 }] }
    ], solver: solver(), projection: { maxDecisionEpochs: 20, maxProjectionNodes: 20 }
  }
});

const nonGreedyStrategy = (): ProjectSspDecisionStrategyV2 => ({
  ...base(["build", "finish-a", "finish-b"], ["a", "b", "a-one", "a-two", "b-done"]),
  model: {
    version: 2,
    features: [{ id: "phase", domain: ["start", "a", "b", "success", "failure", "blocked"], missingValue: "start", source: { kind: "project_state", pointer: "/phase" } }],
    states: [
      { id: "start", values: { phase: "start" } }, { id: "branch-a", values: { phase: "a" } },
      { id: "branch-b", values: { phase: "b" } }, { id: "success", values: { phase: "success" }, terminal: "success" },
      { id: "failure", values: { phase: "failure" }, terminal: "failure" }, { id: "blocked", values: { phase: "blocked" }, terminal: "blocked" }
    ],
    stateActions: [
      { stateId: "start", actionId: "build", expectedCostMicros: 1, successors: [
        { outcomeId: "a", expectedNextStateId: "branch-a", probabilityPpm: 600_000 },
        { outcomeId: "b", expectedNextStateId: "branch-b", probabilityPpm: 400_000 }
      ] },
      { stateId: "branch-a", actionId: "finish-a", expectedCostMicros: 1, successors: [
        { outcomeId: "a-one", expectedNextStateId: "success", probabilityPpm: 500_000 },
        { outcomeId: "a-two", expectedNextStateId: "success", probabilityPpm: 500_000 }
      ] },
      { stateId: "branch-b", actionId: "finish-b", expectedCostMicros: 1, successors: [
        { outcomeId: "b-done", expectedNextStateId: "success", probabilityPpm: 1_000_000 }
      ] }
    ], solver: solver(), projection: { maxDecisionEpochs: 8, maxProjectionNodes: 30 }
  }
});

const solver = () => ({ algorithm: "ssp_value_iteration_v2" as const, epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 });
