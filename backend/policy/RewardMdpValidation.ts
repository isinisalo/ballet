import {
  maxDecisionActionsPerState,
  maxDecisionStates,
  maxDecisionTransitions,
  probabilityScalePpm,
  type DecisionActionModelRowV4,
  type DecisionTransitionV4
} from "../../shared/domain/decisionModel.js";
import type { CompileRewardPolicyInput } from "./RewardMdpCompiler.js";

export function validateCompilerInput(input: CompileRewardPolicyInput): string | undefined {
  const { model } = input;
  if (input.stateIds.length === 0 || input.stateIds.length > maxDecisionStates) {
    return `Decision scope requires 1–${maxDecisionStates} owned states.`;
  }
  if (input.actionIds.length !== input.stateIds.length || input.actionIds.length > maxDecisionActionsPerState) {
    return "Decision scope state and action ids must be the same non-empty owned-node set.";
  }
  if (!equalIds(input.stateIds, input.actionIds)) {
    return "Decision scope state and action ids must be derived from the same owned nodes.";
  }
  if (new Set(input.stateIds).size !== input.stateIds.length) return "Decision scope node ids must be unique.";
  if (!input.stateIds.includes(model.initialStateId)) {
    return `Initial state ${model.initialStateId} is outside the decision scope.`;
  }
  if (model.stateActions.reduce((sum, row) => sum + row.successors.length, 0) > maxDecisionTransitions) {
    return `Decision Model exceeds the ${maxDecisionTransitions} transition limit.`;
  }
  if (!Number.isSafeInteger(model.discountPpm)
    || model.discountPpm <= 0
    || model.discountPpm >= probabilityScalePpm) {
    return "Discount must be an integer strictly between 0 and 1,000,000 ppm.";
  }
  if (input.scope === "graph_node" && model.reward.acceptanceProgressPotentialScaleMicros !== 0) {
    return "Graph Node-local reward cannot include acceptance progress potential.";
  }
  const rewardNumbers = [
    model.reward.actionCostMicros,
    model.reward.terminalSuccessBonusMicros,
    model.reward.acceptanceProgressPotentialScaleMicros,
    ...Object.values(model.reward.outcomePenaltyMicros)
  ];
  if (rewardNumbers.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return "Reward values must be nonnegative safe integers.";
  }
  return validateTransitionRows(input);
}

function validateTransitionRows(input: CompileRewardPolicyInput): string | undefined {
  const stateIds = new Set(input.stateIds);
  const actionIds = new Set(input.actionIds);
  const terminalOutcomes = new Set(input.terminalOutcomeIds);
  const rowKeys = new Set<string>();
  const rowCounts = new Map<string, number>();
  for (const row of input.model.stateActions) {
    const issue = validateTransitionRow(input, row, stateIds, actionIds, terminalOutcomes, rowKeys, rowCounts);
    if (issue) return issue;
  }
  return validateRequiredCells(input, rowKeys, rowCounts);
}

function validateTransitionRow(
  input: CompileRewardPolicyInput,
  row: DecisionActionModelRowV4,
  stateIds: ReadonlySet<string>,
  actionIds: ReadonlySet<string>,
  terminalOutcomes: ReadonlySet<string>,
  rowKeys: Set<string>,
  rowCounts: Map<string, number>
): string | undefined {
  const key = `${row.stateId}\u0000${row.actionId}`;
  if (rowKeys.has(key)) return `Duplicate state/action row ${row.stateId}/${row.actionId}.`;
  rowKeys.add(key);
  if (!stateIds.has(row.stateId)) return `Unknown derived state ${row.stateId}.`;
  if (!actionIds.has(row.actionId)) return `Unknown derived action ${row.actionId}.`;
  rowCounts.set(row.stateId, (rowCounts.get(row.stateId) ?? 0) + 1);
  const outcomeIds = new Set(input.outcomeIdsByAction[row.actionId] ?? []);
  if (row.successors.length === 0) return `State/action row ${row.stateId}/${row.actionId} has no branches.`;
  if (new Set(row.successors.map(({ outcomeId }) => outcomeId)).size !== row.successors.length) {
    return `Outcome ids in ${row.stateId}/${row.actionId} must be unique.`;
  }
  for (const successor of row.successors) {
    const issue = validateSuccessor(input, row, successor, outcomeIds, stateIds, terminalOutcomes);
    if (issue) return issue;
  }
  if (row.successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0) !== probabilityScalePpm) {
    return `Transition probabilities for ${row.stateId}/${row.actionId} must sum to ${probabilityScalePpm.toLocaleString("en-US")} ppm.`;
  }
  return undefined;
}

function validateSuccessor(
  input: CompileRewardPolicyInput,
  row: DecisionActionModelRowV4,
  successor: DecisionTransitionV4,
  outcomeIds: ReadonlySet<string>,
  stateIds: ReadonlySet<string>,
  terminalOutcomes: ReadonlySet<string>
): string | undefined {
  if (!outcomeIds.has(successor.outcomeId)) {
    return `Outcome ${successor.outcomeId} is outside action ${row.actionId}.`;
  }
  if (!Number.isSafeInteger(successor.probabilityPpm) || successor.probabilityPpm <= 0) {
    return `State/action row ${row.stateId}/${row.actionId} has an invalid probability.`;
  }
  if (successor.target.kind === "state") {
    return stateIds.has(successor.target.stateId)
      ? undefined : `Unknown branch target state ${successor.target.stateId}.`;
  }
  if (input.scope === "graph_node"
    && (!successor.target.emitOutcomeId || !terminalOutcomes.has(successor.target.emitOutcomeId))) {
    return `Local terminal in ${row.stateId}/${row.actionId} must emit a Graph Node outcome.`;
  }
  if (input.scope === "graph" && successor.target.emitOutcomeId) {
    return `Graph terminal in ${row.stateId}/${row.actionId} cannot emit a parent outcome.`;
  }
  return undefined;
}

function validateRequiredCells(
  input: CompileRewardPolicyInput,
  rowKeys: ReadonlySet<string>,
  rowCounts: ReadonlyMap<string, number>
): string | undefined {
  for (let stateIndex = 0; stateIndex < input.stateIds.length; stateIndex += 1) {
    const stateId = input.stateIds[stateIndex]!;
    if ((rowCounts.get(stateId) ?? 0) === 0) return `State ${stateId} has no authored action cell.`;
    for (let actionIndex = 0; actionIndex <= stateIndex; actionIndex += 1) {
      const actionId = input.actionIds[actionIndex]!;
      if (!rowKeys.has(`${stateId}\u0000${actionId}`)) {
        return `Required policy cell ${stateId}/${actionId} is incomplete.`;
      }
    }
  }
  return undefined;
}

const equalIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);
