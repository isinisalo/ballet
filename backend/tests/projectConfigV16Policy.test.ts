import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projectConfigReadinessSchema, projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type { ProjectGraphNode, ProjectJobNode } from "../../shared/domain/automation.js";
import type { ProjectSspDecisionStrategyV2 } from "../../shared/domain/decisionModel.js";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import { decisionModelSha256 } from "../policy/DecisionModelCanonical.js";
import { resolveAllAdmissibleActions } from "../policy/AdmissibleActionResolver.js";
import { solvePolicy } from "../policy/SspPolicySolver.js";

describe("project configuration v16 outcome-aware hierarchical SSP/SMDP", () => {
  it("compiles proper global and local policies and chooses solely from configured costs", async () => {
    const config = await policyProject(["discover", "prototype", "publish"]);
    const parsed = projectConfigReadinessSchema.parse(config);
    if (parsed.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2.");
    const solution = solve(parsed.graph.strategy, parsed.graph.graphNodes.map(({ id }) => id));
    expect(solution.selectedActionId).toBe("publish");
    for (const node of parsed.graph.graphNodes) expect(node.strategy.kind).toBe("ssp_v2");
  });

  it("persists a structurally valid uncalibrated draft but blocks Run readiness", async () => {
    const config = await policyProject(["discover"]);
    if (config.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2.");
    config.graph.strategy.model.states = [];
    config.graph.strategy.model.stateActions = [];
    expect(projectConfigSchema.safeParse(config).success).toBe(true);
    expect(projectConfigReadinessSchema.safeParse(config).success).toBe(false);
  });

  it("rejects probability errors, unknown outcome references, and improper policies in either scope", async () => {
    const probability = await policyProject(["discover"]);
    if (probability.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2.");
    probability.graph.strategy.model.stateActions[0]!.successors[0]!.probabilityPpm = 999_999;
    expect(projectConfigReadinessSchema.safeParse(probability).success).toBe(false);

    const unknownOutcome = await policyProject(["discover"]);
    const local = unknownOutcome.graph.graphNodes[0]!.strategy;
    if (local.kind !== "ssp_v2") throw new Error("Expected local SSP v2.");
    local.model.stateActions[0]!.successors[0]!.outcomeId = "outside-contract";
    expect(projectConfigReadinessSchema.safeParse(unknownOutcome).success).toBe(false);

    const improper = await policyProject(["discover"]);
    if (improper.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2.");
    improper.graph.strategy.model.stateActions[0]!.successors = [{
      outcomeId: "discover-fail", expectedNextStateId: "failure", probabilityPpm: 1_000_000
    }];
    expect(projectConfigReadinessSchema.safeParse(improper).success).toBe(false);
  });

  it("keeps policy hashes and selected actions stable under array reordering", async () => {
    const base = await policyProject(["discover", "prototype", "publish"]);
    const reordered = structuredClone(base);
    if (base.graph.strategy.kind !== "ssp_v2" || reordered.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2.");
    reordered.graph.graphNodes.reverse(); reordered.graph.strategy.capabilityModel.actions.reverse();
    reordered.graph.strategy.model.features.reverse(); reordered.graph.strategy.model.states.reverse();
    reordered.graph.strategy.model.stateActions.reverse();
    expect(projectConfigReadinessSchema.safeParse(reordered).success).toBe(true);
    expect(decisionModelSha256(reordered.graph.strategy.model)).toBe(decisionModelSha256(base.graph.strategy.model));
    expect(solve(reordered.graph.strategy, reordered.graph.graphNodes.map(({ id }) => id)).selectedActionId).toBe("publish");
  });

  it("supports 1/40 Graph Nodes and 1/64 Job Nodes without changing platform workflow vocabulary", async () => {
    expect(projectConfigReadinessSchema.safeParse(await policyProject(["solo"])).success).toBe(true);
    const forty = await policyProject(Array.from({ length: 40 }, (_, index) => `node-${String(index + 1).padStart(2, "0")}`));
    expect(projectConfigReadinessSchema.safeParse(forty).success).toBe(true);
    const sixtyFour = await policyProject(["aggregate"], 64);
    expect(projectConfigReadinessSchema.safeParse(sixtyFour).success).toBe(true);
  });
});

const solve = (strategy: ProjectSspDecisionStrategyV2, actionIds: string[]) => solvePolicy({
  model: strategy.model, currentStateId: "start",
  admissibleActionsByState: resolveAllAdmissibleActions(strategy, actionIds), modelSha256: decisionModelSha256(strategy.model)
});

const policyProject = async (ids: string[], jobsPerNode = 1): Promise<ProjectConfiguration> => {
  const repository = JSON.parse(await readFile(".ballet/project.json", "utf8")) as ProjectConfiguration;
  const graphNodes = ids.map((id) => graphNode(id, jobsPerNode));
  return {
    version: 16, executionProfiles: repository.executionProfiles, issueTracker: repository.issueTracker,
    graph: {
      id: "arbitrary-policy", name: "Arbitrary policy", state: { description: "Bounded generic state.", initial: {} },
      strategy: strategyFor(graphNodes.map(({ id, outcomes }) => ({ id, outcomes })), ids.map((id, index) => [id, id === "publish" ? 1 : index + 10])),
      graphNodes
    }
  };
};

const graphNode = (id: string, jobCount: number): ProjectGraphNode => {
  const jobs = Array.from({ length: jobCount }, (_, index) => jobNode(`${id}-job-${index + 1}`));
  return {
    id, description: `Generic ${id} capability.`, capabilities: { accepts: [], provides: [] },
    outcomes: [{ outcomeId: `${id}-pass`, result: "PASS" }, { outcomeId: `${id}-fail`, result: "FAIL" }],
    stateContract: { description: "Uses bounded Graph state." },
    strategy: localStrategy(id, jobs), jobNodes: jobs
  };
};

const jobNode = (id: string): ProjectJobNode => ({
  id, description: `Generic ${id}.`, capabilities: { accepts: [], provides: [] },
  outcomes: [{ outcomeId: `${id}-pass`, result: "PASS" }, { outcomeId: `${id}-fail`, result: "FAIL" }], maxRetries: 0,
  workNode: { id: `${id}-work`, type: "human", description: "Perform work.", task: "Perform work.", nodeStyle: "terra", nodeSize: "medium" },
  validationNode: { id: `${id}-validation`, type: "human", description: "Validate work.", task: "Validate work.", nodeStyle: "luna", nodeSize: "medium" }
});

const localStrategy = (graphNodeId: string, jobs: ProjectJobNode[]) => {
  const strategy = strategyFor(jobs.map(({ id, outcomes }) => ({ id, outcomes })), jobs.map(({ id }, index) => [id, index + 1]));
  strategy.id = `${graphNodeId}-local-policy`;
  strategy.model.states = strategy.model.states.map((state) => state.terminal ? {
    ...state, emitsOutcomeId: state.terminal === "success" ? `${graphNodeId}-pass` : `${graphNodeId}-fail`
  } : state);
  return strategy;
};

const strategyFor = (
  contracts: Array<{ id: string; outcomes: Array<{ outcomeId: string }> }>, costs: Array<[string, number]>
): ProjectSspDecisionStrategyV2 => ({
  kind: "ssp_v2", id: "policy-core", description: "Finite outcome-aware SSP policy.",
  capabilityModel: {
    version: 2,
    outcomes: contracts.flatMap(({ outcomes }) => outcomes.map(({ outcomeId }) => ({ id: outcomeId, description: outcomeId }))),
    actions: contracts.map(({ id }) => ({ actionId: id, guards: [] }))
  },
  model: {
    version: 2,
    features: [{ id: "phase", domain: ["start", "success", "failure", "blocked"], missingValue: "start", source: { kind: "project_state", pointer: "/phase" } }],
    states: [
      { id: "start", values: { phase: "start" } }, { id: "success", values: { phase: "success" }, terminal: "success" },
      { id: "failure", values: { phase: "failure" }, terminal: "failure" }, { id: "blocked", values: { phase: "blocked" }, terminal: "blocked" }
    ],
    stateActions: costs.map(([actionId, expectedCostMicros]) => ({
      stateId: "start", actionId, expectedCostMicros,
      successors: [{ outcomeId: `${actionId}-pass`, expectedNextStateId: "success", probabilityPpm: 1_000_000 }]
    })),
    solver: { algorithm: "ssp_value_iteration_v2", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
    projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
  }
});
