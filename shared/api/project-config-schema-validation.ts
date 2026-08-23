import type { z } from "zod";
import { graphNodeRoutingChildIds, graphRoutingChildIds, routingTerminalResults } from "../domain/automationReachability.js";
import type {
  ProjectCandidateRouting,
  ProjectExecutionComposition,
  ProjectGraphNodeRouteTarget,
  ProjectGraphRouteTarget,
  ProjectIntrinsicOutcome,
  ProjectOrchestrator
} from "../domain/automation.js";
import { sspProbabilityScale, type ProjectSspDecisionStrategyV2 } from "../domain/decisionModel.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

type Path = Array<string | number>;
type ActionContract = { id: string; outcomes: ProjectIntrinsicOutcome[] };

export const validateProjectConfigSchema = (config: ProjectConfiguration, context: z.RefinementCtx): void => {
  if (config.issueTracker.orchestrationDirectory === config.issueTracker.workDirectory) add(
    context, ["issueTracker", "workDirectory"], "Orchestration and work ticket stores must use different directories."
  );
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", ["executionProfiles"], context);
  const resource = (value: ProjectExecutionComposition, path: Path, label: string) => {
    if (!profileIds.has(value.executionProfileId)) add(
      context, [...path, "executionProfileId"], `${label} references unknown execution profile: ${value.executionProfileId}.`
    );
  };
  const graphPath = ["graph"] as Path;
  if (config.graph.strategy.kind === "agent_v1") {
    resource(config.graph.strategy.orchestrator, [...graphPath, "strategy", "orchestrator"], "Graph Orchestrator");
  }
  if (config.graph.repairNode) resource(config.graph.repairNode, [...graphPath, "repairNode"], "Graph Repair Node");
  const graphNodeIds = uniqueIds(config.graph.graphNodes, "Graph Node", [...graphPath, "graphNodes"], context);
  if (config.graph.strategy.kind === "agent_v1") validateRouting(
    config.graph.strategy.orchestrator, graphNodeIds, "graphNodeId",
    [...graphPath, "strategy", "orchestrator", "routing"], Boolean(config.graph.repairNode), context
  );
  else validateSspStrategy(
    config.graph.strategy,
    config.graph.graphNodes.map(({ id, outcomes }) => ({ id, outcomes })),
    [...graphPath, "strategy"],
    undefined,
    context
  );

  const nestedIds = new Set<string>();
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => {
    const base = [...graphPath, "graphNodes", graphNodeIndex];
    if (graphNode.strategy.kind === "agent_v1") {
      resource(graphNode.strategy.orchestrator, [...base, "strategy", "orchestrator"], "Graph Node Orchestrator");
    }
    if (graphNode.repairNode) resource(graphNode.repairNode, [...base, "repairNode"], "Graph Node Repair Node");
    const jobIds = uniqueIds(graphNode.jobNodes, "Job Node", [...base, "jobNodes"], context);
    if (graphNode.strategy.kind === "agent_v1") validateRouting(
      graphNode.strategy.orchestrator, jobIds, "jobNodeId",
      [...base, "strategy", "orchestrator", "routing"], Boolean(graphNode.repairNode), context
    );
    else validateSspStrategy(
      graphNode.strategy,
      graphNode.jobNodes.map(({ id, outcomes }) => ({ id, outcomes })),
      [...base, "strategy"],
      graphNode.outcomes,
      context
    );
    graphNode.jobNodes.forEach((jobNode, jobIndex) => {
      const jobBase = [...base, "jobNodes", jobIndex];
      addUnique(nestedIds, jobNode.id, [...jobBase, "id"], "Job Node", context);
      addUnique(nestedIds, jobNode.workNode.id, [...jobBase, "workNode", "id"], "Work Node", context);
      addUnique(nestedIds, jobNode.validationNode.id, [...jobBase, "validationNode", "id"], "Validation Node", context);
      if (jobNode.workNode.type === "agent") resource(jobNode.workNode, [...jobBase, "workNode"], "Work Node");
      if (jobNode.validationNode.type === "agent") resource(jobNode.validationNode, [...jobBase, "validationNode"], "Validation Node");
    });
  });
};

const validateSspStrategy = (
  strategy: ProjectSspDecisionStrategyV2,
  actionContracts: ActionContract[],
  path: Path,
  emittedOutcomes: ProjectIntrinsicOutcome[] | undefined,
  context: z.RefinementCtx
) => {
  const featurePath = [...path, "model", "features"];
  const featureIds = uniqueIds(strategy.model.features, "Decision feature", featurePath, context);
  const features = new Map(strategy.model.features.map((feature) => [feature.id, feature]));
  strategy.model.features.forEach((feature, index) => {
    if (!feature.domain.includes(feature.missingValue)) add(
      context, [...featurePath, index, "missingValue"], `Missing value must belong to feature ${feature.id}'s domain.`
    );
  });
  const statePath = [...path, "model", "states"];
  const stateIds = uniqueIds(strategy.model.states, "Decision state", statePath, context);
  const stateVectors = new Set<string>();
  const terminalCounts = new Map<string, number>();
  const emittedIds = new Set(emittedOutcomes?.map(({ outcomeId }) => outcomeId) ?? []);
  const emittedResults = new Map(emittedOutcomes?.map(({ outcomeId, result }) => [outcomeId, result]) ?? []);
  strategy.model.states.forEach((state, index) => {
    if (state.terminal) terminalCounts.set(state.terminal, (terminalCounts.get(state.terminal) ?? 0) + 1);
    for (const featureId of featureIds) if (!(featureId in state.values)) add(
      context, [...statePath, index, "values"], `State ${state.id} is missing feature ${featureId}.`
    );
    for (const [key, value] of Object.entries(state.values)) {
      const feature = features.get(key);
      if (!feature) add(context, [...statePath, index, "values", key], `State ${state.id} references unknown feature ${key}.`);
      else if (!feature.domain.includes(value)) add(
        context, [...statePath, index, "values", key], `Value is outside feature ${key}'s domain.`
      );
    }
    const vector = JSON.stringify(Object.entries(state.values).sort(([left], [right]) => left.localeCompare(right)));
    if (stateVectors.has(vector)) add(context, [...statePath, index, "values"], `Decision state ${state.id} duplicates another feature vector.`);
    stateVectors.add(vector);
    if (emittedOutcomes && state.terminal && (!state.emitsOutcomeId || !emittedIds.has(state.emitsOutcomeId))) add(
      context, [...statePath, index, "emitsOutcomeId"],
      `Local terminal ${state.id} must emit a declared Graph Node outcome.`
    );
    if (state.terminal && state.emitsOutcomeId) {
      const expectedResult = state.terminal === "success" ? "PASS" : "FAIL";
      if (emittedResults.get(state.emitsOutcomeId) !== expectedResult) add(
        context, [...statePath, index, "emitsOutcomeId"],
        `${state.terminal} terminal ${state.id} must emit an outcome with ${expectedResult} semantics.`
      );
    }
    if (!state.terminal && state.emitsOutcomeId) add(
      context, [...statePath, index, "emitsOutcomeId"], "Only terminal states may emit an outcome."
    );
  });
  for (const terminal of ["success", "failure", "blocked"] as const) if ((terminalCounts.get(terminal) ?? 0) === 0) add(
    context, statePath, `Decision Model requires an explicit ${terminal} terminal state.`
  );

  const contracts = new Map(actionContracts.map((action) => [action.id, action]));
  const semanticResults = new Map<string, ProjectIntrinsicOutcome["result"]>();
  for (const contract of actionContracts) for (const outcome of contract.outcomes) {
    const previous = semanticResults.get(outcome.outcomeId);
    if (previous && previous !== outcome.result) add(
      context, [...path, "capabilityModel", "outcomes"],
      `Outcome ${outcome.outcomeId} has conflicting intrinsic PASS/FAIL semantics across actions.`
    );
    semanticResults.set(outcome.outcomeId, outcome.result);
  }
  const catalogPath = [...path, "capabilityModel", "outcomes"];
  const catalogIds = uniqueIds(strategy.capabilityModel.outcomes, "Outcome", catalogPath, context);
  const actionPath = [...path, "capabilityModel", "actions"];
  const capabilityIds = new Set<string>();
  strategy.capabilityModel.actions.forEach((action, index) => {
    if (capabilityIds.has(action.actionId)) add(context, [...actionPath, index, "actionId"], `Duplicate capability action ${action.actionId}.`);
    capabilityIds.add(action.actionId);
    if (!contracts.has(action.actionId)) add(context, [...actionPath, index, "actionId"], `Capability Model references unknown action ${action.actionId}.`);
    const guardFeatures = new Set<string>();
    action.guards.forEach((guard, guardIndex) => {
      if (guardFeatures.has(guard.featureId)) add(context, [...actionPath, index, "guards", guardIndex], `Duplicate guard for feature ${guard.featureId}.`);
      guardFeatures.add(guard.featureId);
      const feature = features.get(guard.featureId);
      if (!feature) add(context, [...actionPath, index, "guards", guardIndex, "featureId"], `Guard references unknown feature ${guard.featureId}.`);
      else if (guard.allowedValues.some((value) => !feature.domain.includes(value))) add(
        context, [...actionPath, index, "guards", guardIndex, "allowedValues"],
        `Guard contains a value outside feature ${guard.featureId}'s domain.`
      );
    });
  });
  for (const contract of actionContracts) {
    if (!capabilityIds.has(contract.id)) add(context, actionPath, `Action ${contract.id} requires Capability Model metadata.`);
    if (contract.outcomes.length === 0) add(context, actionPath, `Action ${contract.id} must declare at least one intrinsic outcome.`);
    for (const { outcomeId } of contract.outcomes) if (!catalogIds.has(outcomeId)) add(
      context, catalogPath, `Intrinsic outcome ${outcomeId} from ${contract.id} is missing from the outcome catalog.`
    );
  }

  const rowsPath = [...path, "model", "stateActions"];
  const rowsByState = new Map<string, typeof strategy.model.stateActions>();
  const rowKeys = new Set<string>();
  strategy.model.stateActions.forEach((row, index) => {
    const key = `${row.stateId}\u0000${row.actionId}`;
    if (rowKeys.has(key)) add(context, [...rowsPath, index], `Duplicate state/action row ${row.stateId}/${row.actionId}.`);
    rowKeys.add(key);
    if (!stateIds.has(row.stateId)) add(context, [...rowsPath, index, "stateId"], `Action row references unknown state ${row.stateId}.`);
    const contract = contracts.get(row.actionId);
    if (!contract) add(context, [...rowsPath, index, "actionId"], `Action row references unknown action ${row.actionId}.`);
    if (!capabilityIds.has(row.actionId)) add(context, [...rowsPath, index, "actionId"], `Action ${row.actionId} is outside the Capability Model.`);
    const declaredOutcomes = new Set(contract?.outcomes.map(({ outcomeId }) => outcomeId) ?? []);
    const branches = new Set<string>();
    row.successors.forEach((successor, successorIndex) => {
      const branchKey = `${successor.outcomeId}\u0000${successor.expectedNextStateId}`;
      if (branches.has(branchKey)) add(context, [...rowsPath, index, "successors", successorIndex], `Duplicate outcome/state branch ${branchKey}.`);
      branches.add(branchKey);
      if (!declaredOutcomes.has(successor.outcomeId)) add(
        context, [...rowsPath, index, "successors", successorIndex, "outcomeId"],
        `Outcome ${successor.outcomeId} is not declared by action ${row.actionId}.`
      );
      if (!stateIds.has(successor.expectedNextStateId)) add(
        context, [...rowsPath, index, "successors", successorIndex, "expectedNextStateId"],
        `Transition references unknown state ${successor.expectedNextStateId}.`
      );
    });
    if (row.successors.reduce((sum, successor) => sum + successor.probabilityPpm, 0) !== sspProbabilityScale) add(
      context, [...rowsPath, index, "successors"], `Transition probabilities must sum exactly to ${sspProbabilityScale} ppm.`
    );
    rowsByState.set(row.stateId, [...(rowsByState.get(row.stateId) ?? []), row]);
  });
  strategy.model.states.forEach((state, index) => {
    const rows = rowsByState.get(state.id) ?? [];
    if (state.terminal && rows.length) add(context, [...statePath, index], `Terminal state ${state.id} must be absorbing and have no actions.`);
    if (!state.terminal && !rows.length) add(context, [...statePath, index], `Nonterminal state ${state.id} requires at least one action.`);
  });
  if (!allNonterminalsHaveProperPolicy(strategy)) add(
    context, rowsPath, "Every nonterminal state must have a proper policy that reaches success almost surely."
  );
};

const allNonterminalsHaveProperPolicy = (strategy: ProjectSspDecisionStrategyV2): boolean => {
  const goals = new Set(strategy.model.states.filter(({ terminal }) => terminal === "success").map(({ id }) => id));
  let region = new Set(strategy.model.states.filter(({ terminal }) => !terminal || terminal === "success").map(({ id }) => id));
  const actions = new Map<string, typeof strategy.model.stateActions>();
  for (const row of strategy.model.stateActions) {
    const capability = strategy.capabilityModel.actions.find(({ actionId }) => actionId === row.actionId);
    const state = strategy.model.states.find(({ id }) => id === row.stateId);
    if (!capability || !state || capability.guards.some((guard) => !guard.allowedValues.includes(state.values[guard.featureId]!))) continue;
    actions.set(row.stateId, [...(actions.get(row.stateId) ?? []), row]);
  }
  while (true) {
    const attractor = new Set([...goals].filter((id) => region.has(id)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const stateId of region) if (!attractor.has(stateId) && (actions.get(stateId) ?? []).some((row) =>
        row.successors.every(({ expectedNextStateId }) => region.has(expectedNextStateId))
        && row.successors.some(({ expectedNextStateId }) => attractor.has(expectedNextStateId)))) {
        attractor.add(stateId); changed = true;
      }
    }
    if (attractor.size === region.size) break;
    region = attractor;
  }
  return strategy.model.states.every(({ id, terminal }) => Boolean(terminal) || region.has(id));
};

const validateRouting = <TTarget extends ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>(
  orchestrator: ProjectOrchestrator<TTarget>, childIds: Set<string>, targetKey: "graphNodeId" | "jobNodeId",
  path: Path, repairAvailable: boolean, context: z.RefinementCtx
) => {
  const routing = orchestrator.routing as ProjectCandidateRouting<ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>;
  const routed = targetKey === "graphNodeId"
    ? graphRoutingChildIds(routing as ProjectCandidateRouting<ProjectGraphRouteTarget>)
    : graphNodeRoutingChildIds(routing as ProjectCandidateRouting<ProjectGraphNodeRouteTarget>);
  for (const id of childIds) if (!routed.has(id)) add(context, path, `${labelFor(targetKey)} is unreachable from the candidate union: ${id}.`);
  const terminals = routingTerminalResults(routing);
  for (const result of ["PASS", "FAIL"] as const) if (!terminals.has(result)) add(context, path, `Candidate rules must make terminal ${result} reachable.`);
  if (routing.repair.length && !repairAvailable) add(context, [...path, "repair"], "Repair candidate rules require a Repair Node in the same scope.");
  const ruleIds = new Set<string>();
  [routing.start, ...routing.continuation, ...routing.repair].forEach((rule, ruleIndex) => {
    if (ruleIds.has(rule.id)) add(context, path, `Duplicate routing rule id: ${rule.id}.`);
    ruleIds.add(rule.id);
    const sourceId = "sourceId" in rule ? rule.sourceId : undefined;
    if (typeof sourceId === "string" && !childIds.has(sourceId)) add(context, [...path, ruleIndex, "sourceId"], `Routing rule references unknown source ${sourceId}.`);
    rule.candidates.forEach((candidate, candidateIndex) => {
      const targetId = (candidate.target as unknown as Record<string, unknown>)[targetKey];
      if (typeof targetId === "string" && !childIds.has(targetId)) add(
        context, [...path, ruleIndex, "candidates", candidateIndex, "target", targetKey],
        `Routing candidate references an unknown ${labelFor(targetKey)}.`
      );
    });
  });
};

const labelFor = (key: "graphNodeId" | "jobNodeId") => key === "graphNodeId" ? "Graph Node" : "Job Node";
const uniqueIds = (entries: Array<{ id: string }>, label: string, path: Path, context: z.RefinementCtx): Set<string> => {
  const ids = new Set<string>();
  entries.forEach((entry, index) => addUnique(ids, entry.id, [...path, index, "id"], label, context));
  return ids;
};
const addUnique = (ids: Set<string>, id: string, path: Path, label: string, context: z.RefinementCtx) => {
  if (ids.has(id)) add(context, path, `Duplicate ${label} id: ${id}.`);
  ids.add(id);
};
const add = (context: z.RefinementCtx, path: Path, message: string) => context.addIssue({ code: "custom", path, message });
