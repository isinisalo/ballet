import type { z } from "zod";
import {
  graphNodeRoutingChildIds,
  graphRoutingChildIds,
  routingTerminalResults
} from "../domain/automationReachability.js";
import type {
  ProjectCandidateRouting,
  ProjectExecutionComposition,
  ProjectGraphNodeRouteTarget,
  ProjectGraphRouteTarget,
  ProjectOrchestrator
} from "../domain/automation.js";
import { sspProbabilityScale, type ProjectSspGraphStrategyV1 } from "../domain/decisionModel.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

export const validateProjectConfigSchema = (config: ProjectConfiguration, context: z.RefinementCtx): void => {
  if (config.issueTracker.orchestrationDirectory === config.issueTracker.workDirectory) add(
    context, ["issueTracker", "workDirectory"], "Orchestration and work ticket stores must use different directories."
  );
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", ["executionProfiles"], context);
  const resource = (value: ProjectExecutionComposition, path: Array<string | number>, label: string) => {
    if (!profileIds.has(value.executionProfileId)) add(
      context, [...path, "executionProfileId"], `${label} references unknown execution profile: ${value.executionProfileId}.`
    );
  };

  if (config.graph.strategy.kind === "agent_v1") {
    resource(config.graph.strategy.orchestrator, ["graph", "strategy", "orchestrator"], "Graph Orchestrator");
  }
  if (config.graph.repairNode) resource(config.graph.repairNode, ["graph", "repairNode"], "Graph Repair Node");
  const graphNodeIds = uniqueIds(config.graph.graphNodes, "Graph Node", ["graph", "graphNodes"], context);
  if (config.graph.strategy.kind === "agent_v1") validateRouting(
    config.graph.strategy.orchestrator,
    graphNodeIds,
    "graphNodeId",
    ["graph", "strategy", "orchestrator", "routing"],
    Boolean(config.graph.repairNode),
    context
  );
  else validateSspStrategy(config.graph.strategy, graphNodeIds, ["graph", "strategy"], context);

  const allNestedIds = new Set<string>();
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => {
    const base = ["graph", "graphNodes", graphNodeIndex] as Array<string | number>;
    resource(graphNode.orchestrator, [...base, "orchestrator"], "Graph Node Orchestrator");
    if (graphNode.repairNode) resource(graphNode.repairNode, [...base, "repairNode"], "Graph Node Repair Node");
    const jobIds = uniqueIds(graphNode.jobNodes, "Job Node", [...base, "jobNodes"], context);
    validateRouting(
      graphNode.orchestrator,
      jobIds,
      "jobNodeId",
      [...base, "orchestrator", "routing"],
      Boolean(graphNode.repairNode),
      context
    );
    graphNode.jobNodes.forEach((jobNode, jobIndex) => {
      const jobBase = [...base, "jobNodes", jobIndex];
      addUnique(allNestedIds, jobNode.id, [...jobBase, "id"], "Job Node", context);
      addUnique(allNestedIds, jobNode.workNode.id, [...jobBase, "workNode", "id"], "Work Node", context);
      addUnique(allNestedIds, jobNode.validationNode.id, [...jobBase, "validationNode", "id"], "Validation Node", context);
      if (jobNode.workNode.type === "agent") resource(jobNode.workNode, [...jobBase, "workNode"], "Work Node");
      if (jobNode.validationNode.type === "agent") resource(jobNode.validationNode, [...jobBase, "validationNode"], "Validation Node");
    });
  });
};

const validateSspStrategy = (
  strategy: ProjectSspGraphStrategyV1,
  graphNodeIds: Set<string>,
  path: Array<string | number>,
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
  const terminalCounts = new Map<string, number>();
  const stateVectors = new Set<string>();
  strategy.model.states.forEach((state, index) => {
    if (state.terminal) terminalCounts.set(state.terminal, (terminalCounts.get(state.terminal) ?? 0) + 1);
    const keys = Object.keys(state.values);
    for (const featureId of featureIds) if (!(featureId in state.values)) add(
      context, [...statePath, index, "values"], `State ${state.id} is missing feature ${featureId}.`
    );
    for (const key of keys) {
      const feature = features.get(key);
      if (!feature) add(context, [...statePath, index, "values", key], `State ${state.id} references unknown feature ${key}.`);
      else if (!feature.domain.includes(state.values[key]!)) add(
        context, [...statePath, index, "values", key], `Value is outside feature ${key}'s domain.`
      );
    }
    const vector = JSON.stringify(Object.entries(state.values).sort(([left], [right]) => left.localeCompare(right)));
    if (stateVectors.has(vector)) add(context, [...statePath, index, "values"], `Decision state ${state.id} duplicates another feature vector.`);
    stateVectors.add(vector);
  });
  for (const terminal of ["success", "failure", "blocked"] as const) if ((terminalCounts.get(terminal) ?? 0) === 0) add(
    context, statePath, `Decision Model requires an explicit ${terminal} terminal state.`
  );

  const capabilityPath = [...path, "capabilityGraph", "actions"];
  const capabilityIds = new Set<string>();
  strategy.capabilityGraph.actions.forEach((action, index) => {
    if (capabilityIds.has(action.graphNodeId)) add(context, [...capabilityPath, index, "graphNodeId"], `Duplicate capability action ${action.graphNodeId}.`);
    capabilityIds.add(action.graphNodeId);
    if (!graphNodeIds.has(action.graphNodeId)) add(
      context, [...capabilityPath, index, "graphNodeId"], `Capability Graph references unknown Graph Node: ${action.graphNodeId}.`
    );
    const guardFeatures = new Set<string>();
    action.guards.forEach((guard, guardIndex) => {
      if (guardFeatures.has(guard.featureId)) add(context, [...capabilityPath, index, "guards", guardIndex], `Duplicate guard for feature ${guard.featureId}.`);
      guardFeatures.add(guard.featureId);
      const feature = features.get(guard.featureId);
      if (!feature) add(context, [...capabilityPath, index, "guards", guardIndex, "featureId"], `Guard references unknown feature ${guard.featureId}.`);
      else guard.allowedValues.forEach((value) => {
        if (!feature.domain.includes(value)) add(context, [...capabilityPath, index, "guards", guardIndex, "allowedValues"], `Guard value ${value} is outside feature ${guard.featureId}'s domain.`);
      });
    });
  });
  for (const graphNodeId of graphNodeIds) if (!capabilityIds.has(graphNodeId)) add(
    context, capabilityPath, `Graph Node ${graphNodeId} requires generic Capability Graph metadata.`
  );

  const rowsPath = [...path, "model", "stateActions"];
  const rowKeys = new Set<string>();
  const rowsByState = new Map<string, typeof strategy.model.stateActions>();
  strategy.model.stateActions.forEach((row, index) => {
    const key = `${row.stateId}\u0000${row.graphNodeId}`;
    if (rowKeys.has(key)) add(context, [...rowsPath, index], `Duplicate state/action row ${row.stateId}/${row.graphNodeId}.`);
    rowKeys.add(key);
    if (!stateIds.has(row.stateId)) add(context, [...rowsPath, index, "stateId"], `Action row references unknown state ${row.stateId}.`);
    if (!graphNodeIds.has(row.graphNodeId)) add(context, [...rowsPath, index, "graphNodeId"], `Action row references unknown Graph Node ${row.graphNodeId}.`);
    if (!capabilityIds.has(row.graphNodeId)) add(context, [...rowsPath, index, "graphNodeId"], `Action ${row.graphNodeId} is outside the Capability Graph.`);
    const successors = new Set<string>();
    row.successors.forEach((successor, successorIndex) => {
      if (successors.has(successor.nextStateId)) add(context, [...rowsPath, index, "successors", successorIndex], `Duplicate successor ${successor.nextStateId}.`);
      successors.add(successor.nextStateId);
      if (!stateIds.has(successor.nextStateId)) add(context, [...rowsPath, index, "successors", successorIndex, "nextStateId"], `Transition references unknown state ${successor.nextStateId}.`);
    });
    if (row.successors.reduce((sum, successor) => sum + successor.probabilityPpm, 0) !== sspProbabilityScale) add(
      context, [...rowsPath, index, "successors"], `Transition probabilities must sum exactly to ${sspProbabilityScale} ppm.`
    );
    rowsByState.set(row.stateId, [...(rowsByState.get(row.stateId) ?? []), row]);
  });
  strategy.model.states.forEach((state, index) => {
    const rows = rowsByState.get(state.id) ?? [];
    if (state.terminal && rows.length > 0) add(context, [...statePath, index], `Terminal state ${state.id} must be absorbing and have no actions.`);
    if (!state.terminal && rows.length === 0) add(context, [...statePath, index], `Nonterminal state ${state.id} requires at least one action.`);
    if (rows.length > 40) add(context, [...rowsPath], `State ${state.id} exceeds the 40 action limit.`);
  });
  for (const graphNodeId of capabilityIds) if (!strategy.model.stateActions.some((row) => row.graphNodeId === graphNodeId)) add(
    context, rowsPath, `Capability action ${graphNodeId} requires at least one Decision Model state/action row.`
  );
  if (!allNonterminalsHaveProperPolicy(strategy)) add(
    context, rowsPath, "Every nonterminal state must have a proper policy that reaches success almost surely."
  );
};

const allNonterminalsHaveProperPolicy = (strategy: ProjectSspGraphStrategyV1): boolean => {
  const goals = new Set(strategy.model.states.filter(({ terminal }) => terminal === "success").map(({ id }) => id));
  const candidates = new Set(strategy.model.states.filter(({ terminal }) => !terminal || terminal === "success").map(({ id }) => id));
  const actions = new Map<string, typeof strategy.model.stateActions>();
  for (const row of strategy.model.stateActions) {
    const capability = strategy.capabilityGraph.actions.find(({ graphNodeId }) => graphNodeId === row.graphNodeId);
    const state = strategy.model.states.find(({ id }) => id === row.stateId);
    if (!capability || !state || capability.guards.some((guard) => !guard.allowedValues.includes(state.values[guard.featureId]!))) continue;
    actions.set(row.stateId, [...(actions.get(row.stateId) ?? []), row]);
  }
  let region = candidates;
  while (true) {
    const attractor = new Set([...goals].filter((id) => region.has(id)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const stateId of region) if (!attractor.has(stateId) && (actions.get(stateId) ?? []).some((row) =>
        row.successors.every(({ nextStateId }) => region.has(nextStateId))
        && row.successors.some(({ nextStateId }) => attractor.has(nextStateId)))) {
        attractor.add(stateId); changed = true;
      }
    }
    if (attractor.size === region.size) break;
    region = attractor;
  }
  return strategy.model.states.every(({ id, terminal }) => Boolean(terminal) || region.has(id));
};

const validateRouting = <TTarget extends ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>(
  orchestrator: ProjectOrchestrator<TTarget>,
  childIds: Set<string>,
  targetKey: "graphNodeId" | "jobNodeId",
  path: Array<string | number>,
  repairAvailable: boolean,
  context: z.RefinementCtx
) => {
  const routing = orchestrator.routing as ProjectCandidateRouting<ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>;
  const routedChildIds = targetKey === "graphNodeId"
    ? graphRoutingChildIds(routing as ProjectCandidateRouting<ProjectGraphRouteTarget>)
    : graphNodeRoutingChildIds(routing as ProjectCandidateRouting<ProjectGraphNodeRouteTarget>);
  for (const childId of childIds) if (!routedChildIds.has(childId)) add(
    context, path, `${labelFor(targetKey)} is unreachable from the Orchestrator candidate union: ${childId}.`
  );
  const terminals = routingTerminalResults(routing);
  for (const result of ["PASS", "FAIL"] as const) if (!terminals.has(result)) add(
    context, path, `Orchestrator candidate rules must make terminal ${result} reachable.`
  );
  if (routing.repair.length > 0 && !repairAvailable) add(
    context, [...path, "repair"], "Repair candidate rules require a Repair Node in the same scope."
  );
  const rules = [routing.start, ...routing.continuation, ...routing.repair];
  const ruleIds = new Set<string>();
  rules.forEach((rule, ruleIndex) => {
    if (ruleIds.has(rule.id)) add(context, path, `Duplicate routing rule id: ${rule.id}.`);
    ruleIds.add(rule.id);
    if ("sourceId" in rule && typeof rule.sourceId === "string" && !childIds.has(rule.sourceId)) add(
      context, [...path, ruleIndex, "sourceId"], `Routing rule references an unknown source ${labelFor(targetKey)}: ${rule.sourceId}.`
    );
    rule.candidates.forEach((candidate, candidateIndex) => {
      if (targetKey in candidate.target) {
        const childId = (candidate.target as unknown as Record<string, string>)[targetKey];
        if (!childIds.has(childId)) add(
          context, [...path, ruleIndex, "candidates", candidateIndex, "target", targetKey],
          `Routing candidate references an unknown ${labelFor(targetKey)}: ${childId}.`
        );
      }
    });
  });
};

const labelFor = (key: "graphNodeId" | "jobNodeId") => key === "graphNodeId" ? "Graph Node" : "Job Node";
const uniqueIds = (
  entries: Array<{ id: string }>, label: string, path: Array<string | number>, context: z.RefinementCtx
): Set<string> => {
  const ids = new Set<string>();
  entries.forEach((entry, index) => addUnique(ids, entry.id, [...path, index, "id"], label, context));
  return ids;
};
const addUnique = (
  ids: Set<string>, id: string, path: Array<string | number>, label: string, context: z.RefinementCtx
) => {
  if (ids.has(id)) add(context, path, `Duplicate ${label} id: ${id}.`);
  ids.add(id);
};
const add = (context: z.RefinementCtx, path: Array<string | number>, message: string) =>
  context.addIssue({ code: "custom", path, message });
