import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { addGraphNode, createGenericGraphNode, removeGraphNode, renameGraphNode } from "../src/workspace/automation/graphNodeAuthoring";

const unrelatedIds = ["intake", "threat-model", "implement", "benchmark", "ship"];

describe("generic GraphNode Configure authoring", () => {
  it("creates unrelated capabilities with explicit composition and no platform-purpose mapping", () => {
    let config = baseConfig();
    for (const id of unrelatedIds.slice(1)) config = addGraphNode(config, createGenericGraphNode({
      id, description: id.replaceAll("-", "_").toUpperCase(), executionProfileId: "profile", primaryInstructionId: "project:orchestrator"
    }));
    expect(config.graph.graphNodes.map(({ id }) => id)).toEqual(unrelatedIds);
    if (config.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2 strategy.");
    expect(config.graph.strategy.capabilityModel.actions.map(({ actionId }) => actionId)).toEqual(unrelatedIds);
    expect(config.graph.graphNodes[1]?.strategy.kind).toBe("agent_v1");
  });

  it("renames every policy reference atomically and removes stale action metadata on deletion", () => {
    const renamed = renameGraphNode(baseConfig(), "intake", "triage");
    if (renamed.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2 strategy.");
    expect(renamed.graph.graphNodes.map(({ id }) => id)).toEqual(["triage"]);
    expect(renamed.graph.strategy.capabilityModel.actions[0]?.actionId).toBe("triage");
    expect(renamed.graph.strategy.model.stateActions[0]?.actionId).toBe("triage");
    expect(renamed.graph.strategy.model.features[0]?.domain).toContain("triage");

    const withSecond = addGraphNode(renamed, createGenericGraphNode({ id: "benchmark", description: "BENCHMARK", executionProfileId: "profile", primaryInstructionId: "project:orchestrator" }));
    const removed = removeGraphNode(withSecond, "triage");
    if (removed.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2 strategy.");
    expect(removed.graph.graphNodes.map(({ id }) => id)).toEqual(["benchmark"]);
    expect(removed.graph.strategy.capabilityModel.actions.some(({ actionId }) => actionId === "triage")).toBe(false);
    expect(removed.graph.strategy.model.stateActions.some(({ actionId }) => actionId === "triage")).toBe(false);
  });

  it.each([1, 5, 40])("supports %i dynamically configured GraphNodes", (count) => {
    let config = baseConfig();
    for (let index = 1; index < count; index += 1) config = addGraphNode(config, createGenericGraphNode({
      id: `capability-${index + 1}`, description: `Capability ${index + 1}`, executionProfileId: "profile", primaryInstructionId: "project:orchestrator"
    }));
    expect(config.graph.graphNodes).toHaveLength(count);
  });
});

const baseConfig = (): ProjectAutomationConfig => ({
  version: 16,
  graph: {
    id: "unrelated", name: "Unrelated", state: { description: "Bounded.", initial: { phase: "open" } },
    strategy: {
      kind: "ssp_v2", id: "policy", description: "Policy",
      capabilityModel: {
        version: 2,
        outcomes: [{ id: "intake-pass", description: "Intake succeeded." }],
        actions: [{ actionId: "intake", guards: [] }]
      },
      model: {
        version: 2,
        features: [{ id: "previous", domain: ["none", "intake"], missingValue: "none", source: { kind: "runtime", fact: "previous_action_id" } }],
        states: [{ id: "open", values: { previous: "none" } }, { id: "success", values: { previous: "intake" }, terminal: "success" }, { id: "failure", values: { previous: "none" }, terminal: "failure" }, { id: "blocked", values: { previous: "none" }, terminal: "blocked" }],
        stateActions: [{ stateId: "open", actionId: "intake", expectedCostMicros: 1, successors: [{ outcomeId: "intake-pass", expectedNextStateId: "success", probabilityPpm: 1_000_000 }] }],
        solver: { algorithm: "ssp_value_iteration_v2", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 }, projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
      }
    },
    graphNodes: [createGenericGraphNode({ id: "intake", description: "INTAKE", executionProfileId: "profile", primaryInstructionId: "project:orchestrator" })]
  }
});
