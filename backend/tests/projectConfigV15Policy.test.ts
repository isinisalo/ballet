import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { sspDecisionModelSchema } from "../../shared/api/decision-model-schemas.js";
import type { ProjectGraphNode } from "../../shared/domain/automation.js";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { ProjectSspGraphStrategyV1 } from "../../shared/domain/decisionModel.js";
import { decisionModelSha256 } from "../policy/DecisionModelCanonical.js";
import { resolveAllAdmissibleActions } from "../policy/AdmissibleActionResolver.js";
import { solvePolicy } from "../policy/SspPolicySolver.js";

const arbitraryIds = ["discover", "prototype", "security-check", "package", "publish"];

describe("strict v15 generic SSP project configuration", () => {
  it("accepts arbitrary GraphNode IDs and chooses solely from configured costs", async () => {
    const config = await policyProject(arbitraryIds);
    const parsed = projectConfigSchema.parse(config);
    if (parsed.graph.strategy.kind !== "ssp_v1") throw new Error("Expected SSP strategy.");
    const solution = solve(parsed.graph.strategy, parsed.graph.graphNodes.map(({ id }) => id));
    expect(solution.selectedActionId).toBe("publish");
  });

  it("requires generic metadata when adding a node and rejects stale references when deleting one", async () => {
    const base = await policyProject(arbitraryIds);
    const added = structuredClone(base);
    added.graph.graphNodes.push(graphNode("archive", profile(base)));
    expect(projectConfigSchema.safeParse(added).success).toBe(false);
    if (added.graph.strategy.kind !== "ssp_v1") throw new Error("Expected SSP strategy.");
    added.graph.strategy.capabilityGraph.actions.push({ graphNodeId: "archive", guards: [] });
    added.graph.strategy.model.stateActions.push(action("archive", 60));
    expect(projectConfigSchema.safeParse(added).success).toBe(true);

    const stale = structuredClone(base);
    stale.graph.graphNodes = stale.graph.graphNodes.filter(({ id }) => id !== "prototype");
    expect(projectConfigSchema.safeParse(stale).success).toBe(false);
  });

  it("supports consistent rename and array reordering without changing policy semantics", async () => {
    const base = await policyProject(arbitraryIds);
    const renamed = renameAction(base, "publish", "ship");
    expect(projectConfigSchema.safeParse(renamed).success).toBe(true);
    if (renamed.graph.strategy.kind !== "ssp_v1" || base.graph.strategy.kind !== "ssp_v1") throw new Error("Expected SSP strategy.");
    expect(solve(renamed.graph.strategy, renamed.graph.graphNodes.map(({ id }) => id)).selectedActionId).toBe("ship");

    const reordered = structuredClone(base);
    reordered.graph.graphNodes.reverse();
    if (reordered.graph.strategy.kind !== "ssp_v1") throw new Error("Expected SSP strategy.");
    reordered.graph.strategy.capabilityGraph.actions.reverse();
    reordered.graph.strategy.model.features.reverse();
    reordered.graph.strategy.model.states.reverse();
    reordered.graph.strategy.model.stateActions.reverse();
    expect(projectConfigSchema.safeParse(reordered).success).toBe(true);
    expect(decisionModelSha256(reordered.graph.strategy.model)).toBe(decisionModelSha256(base.graph.strategy.model));
    expect(solve(reordered.graph.strategy, reordered.graph.graphNodes.map(({ id }) => id)).selectedActionId).toBe("publish");
  });

  it("preserves policy behavior when every GraphNode ID is consistently renamed", async () => {
    const base = await policyProject(arbitraryIds);
    const mapping = new Map([
      ["discover", "survey"], ["prototype", "experiment"], ["security-check", "assure"],
      ["package", "bundle"], ["publish", "ship"]
    ]);
    const renamed = [...mapping].reduce((config, [from, to]) => renameAction(config, from, to), base);
    const parsed = projectConfigSchema.parse(renamed);
    if (parsed.graph.strategy.kind !== "ssp_v1") throw new Error("Expected SSP strategy.");
    const solution = solve(parsed.graph.strategy, parsed.graph.graphNodes.map(({ id }) => id));
    expect(solution).toMatchObject({ selectedActionId: "ship", stateValueMicros: 1 });
    expect(solution.actionValues.map(({ graphNodeId }) => graphNodeId).sort()).toEqual([...mapping.values()].sort());
  });

  it("supports one GraphNode and the configured limit of forty", async () => {
    const one = await policyProject(["solo"]);
    expect(projectConfigSchema.safeParse(one).success).toBe(true);
    const forty = await policyProject(Array.from({ length: 40 }, (_, index) => `node-${String(index + 1).padStart(2, "0")}`));
    expect(projectConfigSchema.safeParse(forty).success).toBe(true);
  });

  it("rejects more than 40,960 transition outcomes", async () => {
    const config = await policyProject(["solo"]);
    if (config.graph.strategy.kind !== "ssp_v1") throw new Error("Expected SSP strategy.");
    const oversized = structuredClone(config.graph.strategy.model);
    oversized.stateActions = Array.from({ length: 41 }, (_, rowIndex) => ({
      stateId: "start", graphNodeId: `option-${rowIndex}`, expectedCostMicros: 1,
      successors: Array.from({ length: 1_024 }, () => ({ nextStateId: "success", probabilityPpm: 1 }))
    }));
    expect(sspDecisionModelSchema.safeParse(oversized).success).toBe(false);
  });
});

const solve = (strategy: ProjectSspGraphStrategyV1, graphNodeIds: string[]) => solvePolicy({
  model: strategy.model, currentStateId: "start",
  admissibleActionsByState: resolveAllAdmissibleActions(strategy, graphNodeIds),
  modelSha256: decisionModelSha256(strategy.model)
});

const policyProject = async (ids: string[]): Promise<ProjectConfiguration> => {
  const repository = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
  const selectedProfile = profile(repository);
  return {
    version: 15,
    executionProfiles: repository.executionProfiles,
    issueTracker: repository.issueTracker,
    graph: {
      id: "arbitrary-policy", name: "Arbitrary policy",
      state: { description: "Bounded generic state.", initial: {} },
      strategy: {
        kind: "ssp_v1", id: "policy-core", description: "Finite SSP policy core.",
        nodeStyle: "luna", nodeSize: "medium",
        capabilityGraph: { version: 1, actions: ids.map((graphNodeId) => ({ graphNodeId, guards: [] })) },
        model: {
          version: 1,
          features: [
            { id: "epoch", domain: ["start", "continuation"], missingValue: "start", source: { kind: "runtime", fact: "epoch_kind" } },
            { id: "result", domain: ["none", "PASS", "FAIL", "blocked"], missingValue: "none", source: { kind: "runtime", fact: "previous_graph_node_result" } }
          ],
          states: [
            { id: "start", values: { epoch: "start", result: "none" } },
            { id: "success", values: { epoch: "continuation", result: "PASS" }, terminal: "success" },
            { id: "failure", values: { epoch: "continuation", result: "FAIL" }, terminal: "failure" },
            { id: "blocked", values: { epoch: "continuation", result: "blocked" }, terminal: "blocked" }
          ],
          stateActions: ids.map((id, index) => action(id, id === "publish" ? 1 : index + 10)),
          solver: { algorithm: "ssp_value_iteration_v1", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
          projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
        }
      },
      graphNodes: ids.map((id) => graphNode(id, selectedProfile))
    }
  };
};

const action = (graphNodeId: string, expectedCostMicros: number) => ({
  stateId: "start", graphNodeId, expectedCostMicros,
  successors: [{ nextStateId: "success", probabilityPpm: 1_000_000 }]
});

const graphNode = (id: string, executionProfileId: string): ProjectGraphNode => ({
  id, description: `Generic ${id} capability.`, nodeStyle: "vector-planet", nodeSize: "medium",
  capabilities: { accepts: [], provides: [] }, stateContract: { description: "Uses bounded Graph state." },
  orchestrator: {
    id: `${id}-orchestrator`, description: "Routes the aggregate Job Node.", nodeStyle: "luna", nodeSize: "medium",
    executionProfileId, primaryInstructionId: "project:graph-node-orchestrator", skillIds: [],
    maxTransitions: 256, maxRouteAttempts: 3,
    routing: {
      start: { id: `${id}-start`, candidates: [
        { target: { jobNodeId: `${id}-job` }, description: "Execute the generic Job Node." },
        { target: { terminal: "PASS" }, description: "Complete successfully." },
        { target: { terminal: "FAIL" }, description: "Complete unsuccessfully." }
      ] }, continuation: [], repair: []
    }
  },
  jobNodes: [{
    id: `${id}-job`, description: "Generic aggregate Job Node.", nodeStyle: "terra", nodeSize: "medium",
    capabilities: { accepts: [], provides: [] }, maxRetries: 0,
    workNode: { id: `${id}-work`, type: "human", description: "Perform work.", task: "Perform work.", nodeStyle: "terra", nodeSize: "medium" },
    validationNode: { id: `${id}-validation`, type: "human", description: "Validate work.", task: "Validate work.", nodeStyle: "terra", nodeSize: "medium" }
  }]
});

const profile = (config: ProjectConfiguration) => config.executionProfiles[0]!.id;

const renameAction = (config: ProjectConfiguration, from: string, to: string): ProjectConfiguration => {
  const renamed = structuredClone(config);
  renamed.graph.graphNodes = renamed.graph.graphNodes.map((node) => node.id === from
    ? { ...node, id: to } : node);
  if (renamed.graph.strategy.kind !== "ssp_v1") return renamed;
  renamed.graph.strategy.capabilityGraph.actions = renamed.graph.strategy.capabilityGraph.actions.map((action) =>
    action.graphNodeId === from ? { ...action, graphNodeId: to } : action);
  renamed.graph.strategy.model.stateActions = renamed.graph.strategy.model.stateActions.map((row) =>
    row.graphNodeId === from ? { ...row, graphNodeId: to } : row);
  return renamed;
};
