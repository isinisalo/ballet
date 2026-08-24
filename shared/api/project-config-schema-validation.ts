import type { z } from "zod";
import { nodeResultForTerminal, probabilityScalePpm } from "../domain/decisionModel.js";
import type {
  ProjectExecutionComposition,
  ProjectIntrinsicOutcome
} from "../domain/automation.js";
import type { ProjectScopedRewardDecisionStrategyV4 } from "../domain/decisionModel.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

type Path = Array<string | number>;

export function validateProjectConfigSchema(config: ProjectConfiguration, context: z.RefinementCtx): void {
  validateTrackerDirectories(config, context);
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", ["executionProfiles"], context);
  const graphPath = ["graph"] as Path;
  const graphNodeIds = uniqueIds(config.graph.graphNodes, "Graph Node", [...graphPath, "graphNodes"], context);
  const obligationIds = validateAcceptance(config, context);
  validateNodes(config, profileIds, obligationIds, context);
  validateScope({
    strategy: config.graph.strategy,
    stateIds: [...graphNodeIds],
    outcomesByAction: new Map(config.graph.graphNodes.map((node) => [node.id, node.outcomes])),
    terminalOutcomes: [],
    scope: "graph",
    path: [...graphPath, "strategy"]
  }, context);
}

function validateTrackerDirectories(config: ProjectConfiguration, context: z.RefinementCtx): void {
  if (config.issueTracker.orchestrationDirectory === config.issueTracker.workDirectory) add(
    context, ["issueTracker", "workDirectory"], "Orchestration and work ticket stores must use different directories."
  );
}

function validateAcceptance(config: ProjectConfiguration, context: z.RefinementCtx): Set<string> {
  const ids = new Set<string>();
  config.graph.acceptance.obligations.forEach((obligation, index) => addUnique(
    ids, obligation.obligationId, ["graph", "acceptance", "obligations", index, "obligationId"],
    "acceptance obligation", context
  ));
  return ids;
}

function validateNodes(
  config: ProjectConfiguration,
  profileIds: ReadonlySet<string>,
  obligationIds: ReadonlySet<string>,
  context: z.RefinementCtx
): void {
  const nestedIds = new Set<string>();
  const bindings = new Set<string>();
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => {
    const base = ["graph", "graphNodes", graphNodeIndex] as Path;
    if (graphNode.acceptanceObligationId) {
      if (!obligationIds.has(graphNode.acceptanceObligationId)) add(
        context, [...base, "acceptanceObligationId"],
        `Unknown acceptance obligation ${graphNode.acceptanceObligationId}.`
      );
      if (bindings.has(graphNode.acceptanceObligationId)) add(
        context, [...base, "acceptanceObligationId"],
        `Acceptance obligation ${graphNode.acceptanceObligationId} is already bound to another Graph Node.`
      );
      bindings.add(graphNode.acceptanceObligationId);
    }
    graphNode.outcomes.forEach((outcome, outcomeIndex) => outcome.acceptanceEffects.forEach((effect, effectIndex) => {
      if (!obligationIds.has(effect.obligationId)) add(
        context, [...base, "outcomes", outcomeIndex, "acceptanceEffects", effectIndex, "obligationId"],
        `Unknown acceptance obligation ${effect.obligationId}.`
      );
    }));
    const actionIds = uniqueIds(graphNode.actionNodes, "Action Node", [...base, "actionNodes"], context);
    graphNode.actionNodes.forEach((actionNode, actionIndex) => {
      const actionPath = [...base, "actionNodes", actionIndex];
      addUnique(nestedIds, actionNode.id, [...actionPath, "id"], "Action Node", context);
      addUnique(nestedIds, actionNode.workNode.id, [...actionPath, "workNode", "id"], "Work Node", context);
      addUnique(nestedIds, actionNode.validationNode.id, [...actionPath, "validationNode", "id"], "Validation Node", context);
      if (actionNode.workNode.type === "agent") validateResource(
        actionNode.workNode, [...actionPath, "workNode"], "Work Node", profileIds, context
      );
      if (actionNode.validationNode.type === "agent") validateResource(
        actionNode.validationNode, [...actionPath, "validationNode"], "Validation Node", profileIds, context
      );
    });
    validateScope({
      strategy: graphNode.strategy,
      stateIds: [...actionIds],
      outcomesByAction: new Map(graphNode.actionNodes.map((node) => [node.id, node.outcomes])),
      terminalOutcomes: graphNode.outcomes,
      scope: "graph_node",
      path: [...base, "strategy"]
    }, context);
  });
}

function validateScope(input: {
  strategy: ProjectScopedRewardDecisionStrategyV4;
  stateIds: string[];
  outcomesByAction: ReadonlyMap<string, readonly ProjectIntrinsicOutcome[]>;
  terminalOutcomes: readonly ProjectIntrinsicOutcome[];
  scope: "graph" | "graph_node";
  path: Path;
}, context: z.RefinementCtx): void {
  const { strategy, stateIds, outcomesByAction, terminalOutcomes, scope, path } = input;
  const stateIdSet = new Set(stateIds);
  if (!stateIdSet.has(strategy.model.initialStateId)) add(
    context, [...path, "model", "initialStateId"],
    `Initial state ${strategy.model.initialStateId} must be an owned ${scope === "graph" ? "Graph Node" : "Action Node"} id.`
  );
  if (scope === "graph_node" && strategy.model.reward.acceptanceProgressPotentialScaleMicros !== 0) add(
    context, [...path, "model", "reward", "acceptanceProgressPotentialScaleMicros"],
    "Graph Node-local reward cannot include acceptance progress potential."
  );
  const rowsPath = [...path, "model", "stateActions"];
  const rowKeys = new Set<string>();
  strategy.model.stateActions.forEach((row, rowIndex) => {
    const rowPath = [...rowsPath, rowIndex];
    const key = `${row.stateId}\u0000${row.actionId}`;
    if (rowKeys.has(key)) add(context, rowPath, `Duplicate state/action row ${row.stateId}/${row.actionId}.`);
    rowKeys.add(key);
    if (!stateIdSet.has(row.stateId)) add(context, [...rowPath, "stateId"], `Unknown derived state ${row.stateId}.`);
    if (!stateIdSet.has(row.actionId)) add(context, [...rowPath, "actionId"], `Unknown derived action ${row.actionId}.`);
    const actionOutcomes = new Map((outcomesByAction.get(row.actionId) ?? []).map((outcome) => [outcome.outcomeId, outcome]));
    const branchOutcomes = new Set<string>();
    row.successors.forEach((successor, successorIndex) => {
      const branchPath = [...rowPath, "successors", successorIndex];
      if (branchOutcomes.has(successor.outcomeId)) add(
        context, [...branchPath, "outcomeId"],
        `Outcome ${successor.outcomeId} must be unique inside ${row.stateId}/${row.actionId}.`
      );
      branchOutcomes.add(successor.outcomeId);
      const actionOutcome = actionOutcomes.get(successor.outcomeId);
      if (!actionOutcome) add(context, [...branchPath, "outcomeId"], `Outcome is outside action ${row.actionId}.`);
      if (successor.target.kind === "state" && !stateIdSet.has(successor.target.stateId)) add(
        context, [...branchPath, "target", "stateId"], `Unknown derived target state ${successor.target.stateId}.`
      );
      if (successor.target.kind === "terminal") {
        const emitted = successor.target.emitOutcomeId;
        if (scope === "graph" && emitted) add(
          context, [...branchPath, "target", "emitOutcomeId"], "Graph terminal cannot emit a parent outcome."
        );
        if (scope === "graph_node") {
          const terminalOutcome = terminalOutcomes.find(({ outcomeId }) => outcomeId === emitted);
          if (!emitted || !terminalOutcome) add(
            context, [...branchPath, "target", "emitOutcomeId"], "Local terminal must emit a Graph Node outcome."
          );
          else if (terminalOutcome.result !== nodeResultForTerminal(successor.target.terminal)) add(
            context, [...branchPath, "target", "terminal"],
            `Terminal ${successor.target.terminal} conflicts with emitted outcome ${emitted}.`
          );
        }
      }
    });
    if (row.successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0) !== probabilityScalePpm) add(
      context, [...rowPath, "successors"], `Probabilities must sum exactly to ${probabilityScalePpm} ppm.`
    );
  });
  stateIds.forEach((stateId, stateIndex) => {
    for (let actionIndex = 0; actionIndex <= stateIndex; actionIndex += 1) {
      const actionId = stateIds[actionIndex]!;
      if (!rowKeys.has(`${stateId}\u0000${actionId}`)) add(
        context, rowsPath, `Required policy cell ${stateId}/${actionId} is incomplete.`
      );
    }
  });
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

function addUnique(ids: Set<string>, id: string, path: Path, label: string, context: z.RefinementCtx): void {
  if (ids.has(id)) add(context, path, `Duplicate ${label} id: ${id}.`);
  ids.add(id);
}

function add(context: z.RefinementCtx, path: Path, message: string): void {
  context.addIssue({ code: "custom", path, message });
}
