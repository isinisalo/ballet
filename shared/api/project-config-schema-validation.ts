import type { z } from "zod";
import { probabilityScalePpm } from "../domain/decisionModel.js";
import type { ProjectExecutionComposition, ProjectIntrinsicOutcome } from "../domain/automation.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

type Path = Array<string | number>;

export function validateProjectConfigSchema(config: ProjectConfiguration, context: z.RefinementCtx): void {
  validateTrackerDirectories(config, context);
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", ["executionProfiles"], context);
  validateGraphNodes(config, profileIds, context);
  validateDecisionModel(config, context);
}

function validateTrackerDirectories(config: ProjectConfiguration, context: z.RefinementCtx): void {
  if (config.issueTracker.orchestrationDirectory === config.issueTracker.workDirectory) add(
    context, ["issueTracker", "workDirectory"], "Orchestration and work ticket stores must use different directories."
  );
}

function validateGraphNodes(
  config: ProjectConfiguration,
  profileIds: ReadonlySet<string>,
  context: z.RefinementCtx
): void {
  const graphPath = ["graph"] as Path;
  uniqueIds(config.graph.graphNodes, "Graph Node", [...graphPath, "graphNodes"], context);
  const nestedIds = new Set<string>();
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => {
    const base = [...graphPath, "graphNodes", graphNodeIndex];
    uniqueIds(graphNode.actionNodes, "Action Node", [...base, "actionNodes"], context);
    graphNode.actionNodes.forEach((actionNode, jobIndex) => {
      const jobBase = [...base, "actionNodes", jobIndex];
      addUnique(nestedIds, actionNode.id, [...jobBase, "id"], "Action Node", context);
      addUnique(nestedIds, actionNode.workNode.id, [...jobBase, "workNode", "id"], "Work Node", context);
      addUnique(nestedIds, actionNode.validationNode.id, [...jobBase, "validationNode", "id"], "Validation Node", context);
      if (actionNode.workNode.type === "agent") validateResource(
        actionNode.workNode, [...jobBase, "workNode"], "Work Node", profileIds, context
      );
      if (actionNode.validationNode.type === "agent") validateResource(
        actionNode.validationNode, [...jobBase, "validationNode"], "Validation Node", profileIds, context
      );
    });
  });
}

function validateDecisionModel(config: ProjectConfiguration, context: z.RefinementCtx): void {
  const strategy = config.graph.strategy;
  const path = ["graph", "strategy"] as Path;
  const featureIds = uniqueIds(strategy.model.features, "Decision feature", [...path, "model", "features"], context);
  const features = new Map(strategy.model.features.map((feature) => [feature.id, feature]));
  strategy.model.features.forEach((feature, index) => {
    if (!feature.domain.includes(feature.missingValue)) add(
      context, [...path, "model", "features", index, "missingValue"],
      `Missing value must belong to feature ${feature.id}'s domain.`
    );
  });
  const obligationIds = uniqueObligationIds(config, path, context);
  const stateIds = validateStates(config, featureIds, features, obligationIds, path, context);
  const outcomes = validateCapabilityModel(config, featureIds, features, path, context);
  validateActionRows(config, stateIds, outcomes, path, context);
}

function uniqueObligationIds(config: ProjectConfiguration, path: Path, context: z.RefinementCtx): Set<string> {
  const ids = new Set<string>();
  config.graph.strategy.model.acceptance.obligations.forEach((obligation, index) => {
    addUnique(ids, obligation.obligationId, [...path, "model", "acceptance", "obligations", index, "obligationId"],
      "acceptance obligation", context);
  });
  return ids;
}

function validateStates(
  config: ProjectConfiguration,
  featureIds: ReadonlySet<string>,
  features: ReadonlyMap<string, { domain: string[] }>,
  obligationIds: ReadonlySet<string>,
  path: Path,
  context: z.RefinementCtx
): Set<string> {
  const states = config.graph.strategy.model.states;
  const statePath = [...path, "model", "states"];
  const stateIds = uniqueIds(states, "Decision state", statePath, context);
  const vectors = new Set<string>();
  states.forEach((state, index) => {
    for (const featureId of featureIds) if (!(featureId in state.values)) add(
      context, [...statePath, index, "values"], `State ${state.id} is missing feature ${featureId}.`
    );
    for (const [featureId, value] of Object.entries(state.values)) {
      const feature = features.get(featureId);
      if (!feature) add(context, [...statePath, index, "values", featureId], `Unknown feature ${featureId}.`);
      else if (!feature.domain.includes(value)) add(
        context, [...statePath, index, "values", featureId], `Value is outside feature ${featureId}'s domain.`
      );
    }
    const vector = JSON.stringify({
      features: Object.entries(state.values).sort(([left], [right]) => left.localeCompare(right)),
      verified: [...state.verifiedObligationIds].sort(),
      invalidated: [...state.invalidatedObligationIds].sort()
    });
    if (vectors.has(vector)) add(context, [...statePath, index], `Decision state ${state.id} duplicates another state projection.`);
    vectors.add(vector);
    const classified = [...state.verifiedObligationIds, ...state.invalidatedObligationIds];
    if (new Set(classified).size !== classified.length || classified.some((id) => !obligationIds.has(id))) add(
      context, [...statePath, index], `State ${state.id} has an invalid acceptance-ledger classification.`
    );
  });
  if (!states.some(({ terminal }) => terminal === "success")) add(context, statePath, "Decision Model requires a success terminal.");
  return stateIds;
}

function validateCapabilityModel(
  config: ProjectConfiguration,
  featureIds: ReadonlySet<string>,
  features: ReadonlyMap<string, { domain: string[] }>,
  path: Path,
  context: z.RefinementCtx
): Map<string, ProjectIntrinsicOutcome["result"]> {
  const strategy = config.graph.strategy;
  const graphNodes = new Map(config.graph.graphNodes.map((node) => [node.id, node]));
  const outcomes = new Map<string, ProjectIntrinsicOutcome["result"]>();
  const outcomePath = [...path, "capabilityModel", "outcomes"];
  strategy.capabilityModel.outcomes.forEach((outcome, index) => {
    if (outcomes.has(outcome.id)) add(context, [...outcomePath, index, "id"], `Duplicate outcome ${outcome.id}.`);
    outcomes.set(outcome.id, outcome.result);
  });
  const actionIds = new Set<string>();
  strategy.capabilityModel.actions.forEach((action, actionIndex) => {
    if (actionIds.has(action.actionId)) add(context, [...path, "capabilityModel", "actions", actionIndex],
      `Duplicate action ${action.actionId}.`);
    actionIds.add(action.actionId);
    const graphNode = graphNodes.get(action.actionId);
    if (!graphNode) add(context, [...path, "capabilityModel", "actions", actionIndex, "actionId"],
      `Unknown Graph Node ${action.actionId}.`);
    action.guards.forEach((guard, guardIndex) => {
      const feature = features.get(guard.featureId);
      if (!featureIds.has(guard.featureId) || !feature) add(
        context, [...path, "capabilityModel", "actions", actionIndex, "guards", guardIndex],
        `Guard references unknown feature ${guard.featureId}.`
      );
      else if (guard.allowedValues.some((value) => !feature.domain.includes(value))) add(
        context, [...path, "capabilityModel", "actions", actionIndex, "guards", guardIndex],
        `Guard values are outside feature ${guard.featureId}'s domain.`
      );
    });
    for (const intrinsic of graphNode?.outcomes ?? []) if (outcomes.get(intrinsic.outcomeId) !== intrinsic.result) add(
      context, outcomePath, `Graph Node ${action.actionId} outcome ${intrinsic.outcomeId} lacks matching catalog semantics.`
    );
  });
  for (const graphNode of config.graph.graphNodes) if (!actionIds.has(graphNode.id)) add(
    context, [...path, "capabilityModel", "actions"], `Graph Node ${graphNode.id} requires capability metadata.`
  );
  return outcomes;
}

function validateActionRows(
  config: ProjectConfiguration,
  stateIds: ReadonlySet<string>,
  outcomes: ReadonlyMap<string, ProjectIntrinsicOutcome["result"]>,
  path: Path,
  context: z.RefinementCtx
): void {
  const strategy = config.graph.strategy;
  const rowsPath = [...path, "model", "stateActions"];
  const rowsByState = new Map<string, number>();
  const rowKeys = new Set<string>();
  strategy.model.stateActions.forEach((row, index) => {
    const key = `${row.stateId}\u0000${row.actionId}`;
    if (rowKeys.has(key)) add(context, [...rowsPath, index], `Duplicate state/action row ${row.stateId}/${row.actionId}.`);
    rowKeys.add(key);
    if (!stateIds.has(row.stateId)) add(context, [...rowsPath, index, "stateId"], `Unknown state ${row.stateId}.`);
    if (!strategy.capabilityModel.actions.some(({ actionId }) => actionId === row.actionId)) add(
      context, [...rowsPath, index, "actionId"], `Unknown action ${row.actionId}.`
    );
    const branchKeys = new Set<string>();
    row.successors.forEach((successor, branchIndex) => {
      const branchKey = `${successor.outcomeId}\u0000${successor.nextStateId}`;
      if (branchKeys.has(branchKey)) add(context, [...rowsPath, index, "successors", branchIndex],
        `Duplicate branch ${branchKey}.`);
      branchKeys.add(branchKey);
      if (!outcomes.has(successor.outcomeId)) add(context, [...rowsPath, index, "successors", branchIndex, "outcomeId"],
        `Unknown outcome ${successor.outcomeId}.`);
      if (!stateIds.has(successor.nextStateId)) add(context, [...rowsPath, index, "successors", branchIndex, "nextStateId"],
        `Unknown next state ${successor.nextStateId}.`);
    });
    if (row.successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0) !== probabilityScalePpm) add(
      context, [...rowsPath, index, "successors"], `Probabilities must sum exactly to ${probabilityScalePpm} ppm.`
    );
    rowsByState.set(row.stateId, (rowsByState.get(row.stateId) ?? 0) + 1);
  });
  const states = strategy.model.states;
  states.forEach((state, index) => {
    const count = rowsByState.get(state.id) ?? 0;
    if (state.terminal && count > 0) add(context, [...path, "model", "states", index], "Terminal states cannot have actions.");
    if (!state.terminal && count === 0) add(context, [...path, "model", "states", index], "Nonterminal states require an action.");
  });
  if (!states.some((state) => !state.terminal && (rowsByState.get(state.id) ?? 0) >= 2)) add(
    context, rowsPath, "The Graph Reward-MDP requires a reachable choice state with at least two actions."
  );
}

function validateResource(
  value: ProjectExecutionComposition,
  path: Path,
  label: string,
  profileIds: ReadonlySet<string>,
  context: z.RefinementCtx
): void {
  if (!profileIds.has(value.executionProfileId)) add(
    context, [...path, "executionProfileId"], `${label} references unknown execution profile: ${value.executionProfileId}.`
  );
}

function uniqueIds(
  entries: Array<{ id: string }>,
  label: string,
  path: Path,
  context: z.RefinementCtx
): Set<string> {
  const ids = new Set<string>();
  entries.forEach((entry, index) => addUnique(ids, entry.id, [...path, index, "id"], label, context));
  return ids;
}

function addUnique(
  ids: Set<string>, id: string, path: Path, label: string, context: z.RefinementCtx
): void {
  if (ids.has(id)) add(context, path, `Duplicate ${label} id: ${id}.`);
  ids.add(id);
}

function add(context: z.RefinementCtx, path: Path, message: string): void {
  context.addIssue({ code: "custom", path, message });
}
