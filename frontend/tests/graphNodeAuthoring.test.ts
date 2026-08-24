import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { automationConfigSchema, defaultProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  actionNodeReferences,
  addActionNode,
  addGraphNode,
  createGenericActionNode,
  createGenericGraphNode,
  graphNodeReferences,
  removeActionNode,
  removeGraphNode,
  renameActionNode,
  renameGraphNode
} from "../src/workspace/automation/graphNodeAuthoring";

const input = (id: string) => ({
  id,
  description: id.toUpperCase(),
  executionProfileId: "profile",
  primaryInstructionId: "project:instruction"
});

describe("hierarchical Reward-MDP node authoring", () => {
  it("adds ten Graph Nodes as new rows and columns without growing the acceptance ledger", () => {
    const project = JSON.parse(readFileSync(".ballet/project.json", "utf8"));
    let config = automationConfigSchema.parse({ version: project.version, graph: project.graph });
    const obligations = config.graph.acceptance.obligations.map(({ obligationId }) => obligationId);
    for (let index = 1; index <= 10; index += 1) {
      config = addGraphNode(config, createGenericGraphNode(input(`extra-${index}`)));
    }
    expect(config.version).toBe(19);
    expect(config.graph.graphNodes).toHaveLength(15);
    expect(config.graph.graphNodes.at(-1)?.strategy.model.stateActions).toHaveLength(1);
    expect(config.graph.acceptance.obligations.map(({ obligationId }) => obligationId)).toEqual(obligations);
    expect(config.graph.strategy.model.stateActions).toHaveLength(15);
    expect(15 * 15 - config.graph.strategy.model.stateActions.length).toBe(210);
  });

  it("renames global initial, row, action and state-target references atomically", () => {
    const node = createGenericGraphNode(input("intake"));
    const config = addGraphNode(defaultProjectAutomationConfig(), node);
    config.graph.strategy = {
      ...config.graph.strategy,
      model: {
        ...config.graph.strategy.model,
        initialStateId: "intake",
        stateActions: [{
          stateId: "intake", actionId: "intake", guards: [], successors: [{
            outcomeId: "intake-complete",
            target: { kind: "state", stateId: "intake" },
            probabilityPpm: 1_000_000,
            provenance: "default_prior",
            penaltyClass: "none"
          }]
        }]
      }
    };
    const renamed = renameGraphNode(config, "intake", "triage");
    expect(renamed.graph.graphNodes[0]?.id).toBe("triage");
    expect(renamed.graph.strategy.model.initialStateId).toBe("triage");
    expect(renamed.graph.strategy.model.stateActions[0]).toMatchObject({
      stateId: "triage", actionId: "triage", successors: [{ target: { kind: "state", stateId: "triage" } }]
    });
    expect(graphNodeReferences(renamed, "triage")).toHaveLength(4);
  });

  it("blocks deletion while global or local policy references remain", () => {
    const added = addGraphNode(defaultProjectAutomationConfig(), createGenericGraphNode(input("build")));
    const graphConfig = {
      ...added,
      graph: {
        ...added.graph,
        strategy: { ...added.graph.strategy, model: { ...added.graph.strategy.model, initialStateId: "build" } }
      }
    };
    expect(removeGraphNode(graphConfig, "build")).toEqual(graphConfig);
    expect(graphNodeReferences(graphConfig, "build")).toEqual(["graph.strategy.model.initialStateId"]);

    const graphNode = graphConfig.graph.graphNodes[0]!;
    expect(actionNodeReferences(graphNode, "build-action")).toEqual([
      "build.strategy.model.initialStateId",
      "build.strategy.model.stateActions.0.stateId",
      "build.strategy.model.stateActions.0.actionId"
    ]);
    expect(removeActionNode(graphConfig, "build", "build-action")).toEqual(graphConfig);
  });

  it("renames every local policy reference and leaves newly added Action cells incomplete", () => {
    let config = addGraphNode(defaultProjectAutomationConfig(), createGenericGraphNode(input("build")));
    config = renameActionNode(config, "build", "build-action", "implement");
    const renamed = config.graph.graphNodes[0]!;
    expect(renamed.actionNodes[0]?.id).toBe("implement");
    expect(renamed.strategy.model.initialStateId).toBe("implement");
    expect(renamed.strategy.model.stateActions[0]).toMatchObject({ stateId: "implement", actionId: "implement" });

    config = addActionNode(config, "build", createGenericActionNode(input("validate-package")));
    const expanded = config.graph.graphNodes[0]!;
    expect(expanded.actionNodes).toHaveLength(2);
    expect(expanded.strategy.model.stateActions).toHaveLength(1);
    expect(2 * 2 - expanded.strategy.model.stateActions.length).toBe(3);
  });

  it.each([1, 5, 40])("supports %i dynamically configured Graph Nodes", (count) => {
    let config = defaultProjectAutomationConfig();
    for (let index = 0; index < count; index += 1) {
      config = addGraphNode(config, createGenericGraphNode(input(`capability-${index + 1}`)));
    }
    expect(config.graph.graphNodes).toHaveLength(count);
    expect(config.graph.graphNodes.every(({ strategy }) => strategy.kind === "reward_mdp_v4")).toBe(true);
  });
});
