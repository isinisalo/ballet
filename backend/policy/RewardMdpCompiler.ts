import type { JsonValue } from "../../shared/domain/automation.js";
import {
  maxDecisionActionsPerState,
  maxDecisionStates,
  maxDecisionTransitions,
  probabilityScalePpm,
  type DecisionActionModelRowV3,
  type DecisionStateDefinitionV3,
  type ProjectCapabilityModelV3,
  type ProjectRewardDecisionModelV3
} from "../../shared/domain/decisionModel.js";
import type {
  CompiledRewardPolicyV3,
  RewardActionValueV3,
  RewardMdpCompilerStatus
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

export interface CompileRewardPolicyInput {
  model: ProjectRewardDecisionModelV3;
  capabilityModel: ProjectCapabilityModelV3;
  admissibleActionsByState: Readonly<Record<string, readonly string[]>>;
  modelSha256: string;
}

export interface RewardBreakdown {
  completionBonusMicros: number;
  actionCostMicros: number;
  outcomePenaltyMicros: number;
  verifiedProgressDeltaPpm: number;
  potentialDeltaMicros: number;
  netRewardMicros: number;
}

export const compileRewardPolicy = (input: CompileRewardPolicyInput): CompiledRewardPolicyV3 => {
  const invalid = validateCompilerInput(input);
  if (invalid) return failure("policy_model_invalid", input, invalid);
  const states = [...input.model.states].sort(byId);
  const stateById = new Map(states.map((state) => [state.id, state]));
  const rows = rowsByState(input);
  const terminalIds = new Set(states.filter(({ terminal }) => terminal).map(({ id }) => id));
  const terminalReachable = reverseReachable(terminalIds, rows);
  const unreachable = states.find(({ terminal, id }) => !terminal && !terminalReachable.has(id));
  if (unreachable) return failure(
    "policy_goal_unreachable", input, `No terminal state is reachable from state ${unreachable.id}.`
  );

  let values = new Map(states.map(({ id }) => [id, 0]));
  let residualMicros = 0;
  let iterations = 0;
  for (iterations = 1; iterations <= input.model.solver.maxIterations; iterations += 1) {
    const next = new Map(values);
    residualMicros = 0;
    for (const state of states) {
      if (state.terminal) continue;
      const qValues = (rows.get(state.id) ?? []).map((row) => qValue(input, row, values, stateById));
      if (qValues.length === 0 || qValues.some((value) => !Number.isSafeInteger(value))) {
        return failure("policy_model_invalid", input, `State ${state.id} has no finite admissible action.`);
      }
      const value = Math.max(...qValues);
      residualMicros = Math.max(residualMicros, Math.abs(value - values.get(state.id)!));
      next.set(state.id, value);
    }
    values = next;
    if (residualMicros <= input.model.solver.convergenceToleranceMicros) break;
  }
  if (residualMicros > input.model.solver.convergenceToleranceMicros) return failure(
    "policy_not_converged", input, "Discounted value iteration did not converge within the deterministic iteration bound.",
    input.model.solver.maxIterations, residualMicros
  );

  const compiledStates = states.filter(({ terminal }) => !terminal).map((state) => {
    const actionValues = (rows.get(state.id) ?? []).map((row): RewardActionValueV3 => ({
      actionId: row.actionId,
      qMicros: qValue(input, row, values, stateById)
    })).sort((left, right) => left.actionId.localeCompare(right.actionId));
    const best = [...actionValues].sort((left, right) => right.qMicros - left.qMicros
      || left.actionId.localeCompare(right.actionId))[0]!;
    return { stateId: state.id, selectedActionId: best.actionId, valueMicros: best.qMicros, actionValues };
  });
  const selectedRows = new Map(compiledStates.map((state) => [
    state.stateId,
    rows.get(state.stateId)!.find(({ actionId }) => actionId === state.selectedActionId)!
  ]));
  if (!selectedPolicyIsAbsorbing(states, selectedRows)) return failure(
    "policy_no_proper_policy", input, "The selected policy contains a reachable nonterminal recurrent class.",
    iterations, residualMicros
  );
  const policyDocument = Object.fromEntries(compiledStates.map(({ stateId, selectedActionId }) => [stateId, selectedActionId]));
  return {
    version: 3,
    algorithm: "discounted_value_iteration_v3",
    status: "compiled",
    states: compiledStates,
    iterations,
    residualMicros,
    modelSha256: input.modelSha256,
    policySha256: jsonSha256(policyDocument as JsonValue)
  };
};

export const rewardBreakdown = (
  model: ProjectRewardDecisionModelV3,
  capabilityModel: ProjectCapabilityModelV3,
  current: DecisionStateDefinitionV3,
  successor: DecisionStateDefinitionV3,
  outcomeId: string
): RewardBreakdown => {
  const penaltyClass = capabilityModel.outcomes.find(({ id }) => id === outcomeId)!.penaltyClass;
  const actionCostMicros = model.reward.actionCostMicros;
  const completionBonusMicros = successor.terminal === "success" ? model.reward.completionBonusMicros : 0;
  const outcomePenaltyMicros = model.reward.outcomePenaltyMicros[penaltyClass];
  const verifiedProgressDeltaPpm = stateProgressPpm(model, successor) - stateProgressPpm(model, current);
  const currentPotential = statePotentialMicros(model, current);
  const successorPotential = statePotentialMicros(model, successor);
  const discountedSuccessorPotential = multiplyPpm(successorPotential, model.discountPpm);
  const potentialDeltaMicros = discountedSuccessorPotential - currentPotential;
  return {
    completionBonusMicros,
    actionCostMicros,
    outcomePenaltyMicros,
    verifiedProgressDeltaPpm,
    potentialDeltaMicros,
    netRewardMicros: completionBonusMicros - actionCostMicros - outcomePenaltyMicros + potentialDeltaMicros
  };
};

export const stateProgressPpm = (
  model: ProjectRewardDecisionModelV3,
  state: DecisionStateDefinitionV3
): number => {
  const weights = new Map(model.acceptance.obligations.map(({ obligationId, weight }) => [obligationId, weight]));
  const total = model.acceptance.obligations.reduce((sum, { weight }) => sum + weight, 0);
  if (total === 0) return state.terminal === "success" ? probabilityScalePpm : 0;
  const verified = state.verifiedObligationIds.reduce((sum, obligationId) => sum + (weights.get(obligationId) ?? 0), 0);
  return Math.round(verified * probabilityScalePpm / total);
};

const statePotentialMicros = (model: ProjectRewardDecisionModelV3, state: DecisionStateDefinitionV3): number =>
  multiplyPpm(model.reward.progressPotentialScaleMicros, stateProgressPpm(model, state) - probabilityScalePpm);

const qValue = (
  input: CompileRewardPolicyInput,
  row: DecisionActionModelRowV3,
  values: ReadonlyMap<string, number>,
  stateById: ReadonlyMap<string, DecisionStateDefinitionV3>
): number => {
  const current = stateById.get(row.stateId)!;
  const terms = [...row.successors].sort((left, right) => left.outcomeId.localeCompare(right.outcomeId)
    || left.nextStateId.localeCompare(right.nextStateId)).map((successor) => {
    const next = stateById.get(successor.nextStateId)!;
    const immediate = rewardBreakdown(input.model, input.capabilityModel, current, next, successor.outcomeId).netRewardMicros;
    const continuation = multiplyPpm(values.get(successor.nextStateId)!, input.model.discountPpm);
    return multiplyPpm(immediate + continuation, successor.probabilityPpm);
  });
  return terms.reduce((sum, value) => sum + value, 0);
};

const validateCompilerInput = (input: CompileRewardPolicyInput): string | undefined => {
  const { model, capabilityModel } = input;
  if (model.states.length > maxDecisionStates) return `Decision Model exceeds the ${maxDecisionStates} state limit.`;
  if (model.stateActions.reduce((sum, row) => sum + row.successors.length, 0) > maxDecisionTransitions) {
    return `Decision Model exceeds the ${maxDecisionTransitions} transition limit.`;
  }
  if (!Number.isSafeInteger(model.discountPpm) || model.discountPpm <= 0 || model.discountPpm >= probabilityScalePpm) {
    return "Discount must be an integer strictly between 0 and 1,000,000 ppm.";
  }
  const stateIds = new Set(model.states.map(({ id }) => id));
  if (stateIds.size !== model.states.length) return "Decision state IDs must be unique.";
  const outcomeIds = new Set(capabilityModel.outcomes.map(({ id }) => id));
  const obligationIds = new Set(model.acceptance.obligations.map(({ obligationId }) => obligationId));
  if (obligationIds.size !== model.acceptance.obligations.length) return "Acceptance obligation IDs must be unique.";
  if (model.acceptance.obligations.some(({ weight }) => !Number.isSafeInteger(weight) || weight <= 0)) {
    return "Acceptance obligation weights must be positive safe integers.";
  }
  return validateLedgerStates(model, obligationIds) ?? validateTransitionRows(model, stateIds, outcomeIds);
};

const validateLedgerStates = (
  model: ProjectRewardDecisionModelV3,
  obligationIds: ReadonlySet<string>
): string | undefined => {
  for (const state of model.states) {
    const classified = [...state.verifiedObligationIds, ...state.invalidatedObligationIds];
    if (new Set(classified).size !== classified.length || classified.some((id) => !obligationIds.has(id))) {
      return `State ${state.id} has an invalid acceptance-ledger classification.`;
    }
  }
  return undefined;
};

const validateTransitionRows = (
  model: ProjectRewardDecisionModelV3,
  stateIds: ReadonlySet<string>,
  outcomeIds: ReadonlySet<string>
): string | undefined => {
  const rowKeys = new Set<string>();
  const rowCounts = new Map<string, number>();
  for (const row of model.stateActions) {
    const key = `${row.stateId}\u0000${row.actionId}`;
    if (rowKeys.has(key)) return `Duplicate state/action row ${row.stateId}/${row.actionId}.`;
    rowKeys.add(key);
    if (!stateIds.has(row.stateId)) return `Unknown state ${row.stateId}.`;
    if (model.states.find(({ id }) => id === row.stateId)?.terminal) return `Terminal state ${row.stateId} cannot have actions.`;
    const count = (rowCounts.get(row.stateId) ?? 0) + 1;
    rowCounts.set(row.stateId, count);
    if (count > maxDecisionActionsPerState) return `State ${row.stateId} has too many actions.`;
    if (row.successors.length === 0 || row.successors.some(({ outcomeId, nextStateId, probabilityPpm }) =>
      !outcomeIds.has(outcomeId) || !stateIds.has(nextStateId) || !Number.isSafeInteger(probabilityPpm) || probabilityPpm <= 0)) {
      return `State/action row ${row.stateId}/${row.actionId} has an invalid branch.`;
    }
    if (row.successors.reduce((sum, { probabilityPpm }) => sum + probabilityPpm, 0) !== probabilityScalePpm) {
      return `Transition probabilities for ${row.stateId}/${row.actionId} must sum to ${probabilityScalePpm} ppm.`;
    }
  }
  return undefined;
};

const rowsByState = (input: CompileRewardPolicyInput): Map<string, DecisionActionModelRowV3[]> => {
  const allowed = new Map(Object.entries(input.admissibleActionsByState)
    .map(([stateId, actions]) => [stateId, new Set(actions)]));
  const result = new Map<string, DecisionActionModelRowV3[]>();
  for (const row of [...input.model.stateActions].sort((left, right) => left.stateId.localeCompare(right.stateId)
    || left.actionId.localeCompare(right.actionId))) {
    if (!allowed.get(row.stateId)?.has(row.actionId)) continue;
    result.set(row.stateId, [...(result.get(row.stateId) ?? []), row]);
  }
  return result;
};

const reverseReachable = (terminals: Set<string>, rows: ReadonlyMap<string, DecisionActionModelRowV3[]>): Set<string> => {
  const result = new Set(terminals);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [stateId, actions] of rows) if (!result.has(stateId)
      && actions.some(({ successors }) => successors.some(({ nextStateId }) => result.has(nextStateId)))) {
      result.add(stateId);
      changed = true;
    }
  }
  return result;
};

const selectedPolicyIsAbsorbing = (
  states: DecisionStateDefinitionV3[],
  policy: ReadonlyMap<string, DecisionActionModelRowV3>
): boolean => {
  const remaining = new Set(states.filter(({ terminal }) => !terminal).map(({ id }) => id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const stateId of [...remaining]) {
      const successors = policy.get(stateId)?.successors ?? [];
      if (successors.length > 0 && successors.some(({ nextStateId }) => !remaining.has(nextStateId))) {
        remaining.delete(stateId);
        changed = true;
      }
    }
  }
  return remaining.size === 0;
};

const multiplyPpm = (value: number, ppm: number): number => Math.round(value * ppm / probabilityScalePpm);
const byId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);
const failure = (
  status: Exclude<RewardMdpCompilerStatus, "compiled">,
  input: CompileRewardPolicyInput,
  message: string,
  iterations = 0,
  residualMicros = 0
): CompiledRewardPolicyV3 => ({
  version: 3,
  algorithm: "discounted_value_iteration_v3",
  status,
  states: [],
  iterations,
  residualMicros,
  modelSha256: input.modelSha256,
  message
});
