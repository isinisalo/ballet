import { describe, expect, it } from "vitest";
import { defaultProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  addGraphNode,
  addActionNode,
  createGenericGraphNode,
  createGenericActionNode,
  actionNodeReferences,
  removeGraphNode,
  renameGraphNode
} from "../src/workspace/automation/graphNodeAuthoring";

const input = (id: string) => ({
  id,
  description: id.toUpperCase(),
  executionProfileId: "profile",
  primaryInstructionId: "project:instruction"
});

describe("Reward-MDP Graph Node authoring", () => {
  it("adds arbitrary Graph Nodes to the global capability model without a local policy", () => {
    let config = defaultProjectAutomationConfig();
    for (const id of ["intake", "threat-model", "implement", "benchmark", "ship"]) {
      config = addGraphNode(config, createGenericGraphNode(input(id)));
    }
    expect(config.version).toBe(18);
    expect(config.graph.graphNodes.map(({ id }) => id)).toEqual([
      "intake", "threat-model", "implement", "benchmark", "ship"
    ]);
    expect(config.graph.strategy.capabilityModel.actions.map(({ actionId }) => actionId)).toEqual([
      "intake", "threat-model", "implement", "benchmark", "ship"
    ]);
    expect(config.graph.graphNodes.every((node) => !("strategy" in node) && !("repairNode" in node))).toBe(true);
  });

  it("renames and removes every global Reward-MDP action reference atomically", () => {
    const config = addGraphNode(defaultProjectAutomationConfig(), createGenericGraphNode(input("intake")));
    config.graph.strategy.model.stateActions.push({
      stateId: "open",
      actionId: "intake",
      successors: [{
        outcomeId: "intake-complete",
        nextStateId: "done",
        probabilityPpm: 1_000_000,
        provenance: "default_prior"
      }]
    });
    const renamed = renameGraphNode(config, "intake", "triage");
    expect(renamed.graph.graphNodes[0]?.id).toBe("triage");
    expect(renamed.graph.strategy.capabilityModel.actions[0]?.actionId).toBe("triage");
    expect(renamed.graph.strategy.model.stateActions[0]?.actionId).toBe("triage");

    const removed = removeGraphNode(renamed, "triage");
    expect(removed.graph.graphNodes).toEqual([]);
    expect(removed.graph.strategy.capabilityModel.actions).toEqual([]);
    expect(removed.graph.strategy.model.stateActions).toEqual([]);
  });

  it("keeps Action Nodes in authored array order with no policy references", () => {
    const node = createGenericGraphNode(input("build"));
    const config = addActionNode(
      addGraphNode(defaultProjectAutomationConfig(), node),
      "build",
      createGenericActionNode(input("validate-package"))
    );
    expect(config.graph.graphNodes[0]?.actionNodes.map(({ id }) => id)).toEqual([
      "build-action", "validate-package"
    ]);
    expect(actionNodeReferences(config.graph.graphNodes[0]!, "build-action")).toEqual([]);
  });

  it.each([1, 5, 40])("supports %i dynamically configured Graph Nodes", (count) => {
    let config = defaultProjectAutomationConfig();
    for (let index = 0; index < count; index += 1) {
      config = addGraphNode(config, createGenericGraphNode(input(`capability-${index + 1}`)));
    }
    expect(config.graph.graphNodes).toHaveLength(count);
  });
});
