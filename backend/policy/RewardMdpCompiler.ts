import type { JsonValue } from "../../shared/domain/automation.js";
import {
  probabilityScalePpm,
  type DecisionActionModelRowV4,
  type DecisionPolicyScope,
  type DecisionTransitionV4,
  type OutcomePenaltyClass,
  type ProjectScopedRewardDecisionModelV4
} from "../../shared/domain/decisionModel.js";
import type {
  CompiledRewardPolicyV4,
  RewardActionValueV4,
  RewardMdpCompilerStatus
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { validateCompilerInput } from "./RewardMdpValidation.js";

export interface CompileRewardPolicyInput {
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  model: ProjectScopedRewardDecisionModelV4;
  stateIds: readonly string[];
  actionIds: readonly string[];
  outcomeIdsByAction: Readonly<Record<string, readonly string[]>>;
  terminalOutcomeIds: readonly string[];
  admissibleActionsByState: Readonly<Record<string, readonly string[]>>;
  acceptanceProgressPpmByState: Readonly<Record<string, number>>;
  modelSha256: string;
}

export interface RewardBreakdown {
  terminalSuccessBonusMicros: number;
  actionCostMicros: number;
  outcomePenaltyMicros: number;
  acceptanceProgressDeltaPpm: number;
  potentialDeltaMicros: number;
  netRewardMicros: number;
}

export const compileRewardPolicy = (input: CompileRewardPolicyInput): CompiledRewardPolicyV4 => {
  const invalid = validateCompilerInput(input);
  if (invalid) return failure("policy_model_invalid", input, invalid);
  const stateIds = [...input.stateIds];
  const rows = rowsByState(input);
  const terminalReachable = reverseReachable(rows);
  const unreachable = stateIds.find((stateId) => !terminalReachable.has(stateId));
  if (unreachable) return failure(
    "policy_goal_unreachable", input, `No terminal branch is reachable from state ${unreachable}.`
  );

  let values = new Map(stateIds.map((id) => [id, 0]));
  let residualMicros = 0;
  let iterations = 0;
  for (iterations = 1; iterations <= input.model.solver.maxIterations; iterations += 1) {
    const next = new Map(values);
    residualMicros = 0;
    for (const stateId of stateIds) {
      const qValues = (rows.get(stateId) ?? []).map((row) => qValue(input, row, values));
      if (qValues.length === 0 || qValues.some((value) => !Number.isSafeInteger(value))) {
        return failure("policy_model_invalid", input, `State ${stateId} has no finite admissible action.`);
      }
      const value = Math.max(...qValues);
      residualMicros = Math.max(residualMicros, Math.abs(value - values.get(stateId)!));
      next.set(stateId, value);
    }
    values = next;
    if (residualMicros <= input.model.solver.convergenceToleranceMicros) break;
  }
  if (residualMicros > input.model.solver.convergenceToleranceMicros) return failure(
    "policy_not_converged", input, "Discounted value iteration did not converge within the deterministic iteration bound.",
    input.model.solver.maxIterations, residualMicros
  );

  const compiledStates = stateIds.map((stateId) => {
    const actionValues = (rows.get(stateId) ?? []).map((row): RewardActionValueV4 => ({
      actionId: row.actionId,
      qMicros: qValue(input, row, values)
    })).sort((left, right) => left.actionId.localeCompare(right.actionId));
    const best = [...actionValues].sort((left, right) => right.qMicros - left.qMicros
      || left.actionId.localeCompare(right.actionId))[0]!;
    return { stateId, selectedActionId: best.actionId, valueMicros: best.qMicros, actionValues };
  });
  const selectedRows = new Map(compiledStates.map((state) => [
    state.stateId,
    rows.get(state.stateId)!.find(({ actionId }) => actionId === state.selectedActionId)!
  ]));
  if (!selectedPolicyIsAbsorbing(stateIds, selectedRows)) return failure(
    "policy_no_proper_policy", input, "The selected policy contains a reachable nonterminal recurrent class.",
    iterations, residualMicros
  );
  const policyDocument = Object.fromEntries(compiledStates.map(({ stateId, selectedActionId }) => [stateId, selectedActionId]));
  return {
    version: 4,
    scope: input.scope,
    ...(input.graphNodeId ? { graphNodeId: input.graphNodeId } : {}),
    algorithm: "discounted_value_iteration_v4",
    status: "compiled",
    initialStateId: input.model.initialStateId,
    stateIds,
    actionIds: [...input.actionIds],
    states: compiledStates,
    iterations,
    residualMicros,
    modelSha256: input.modelSha256,
    policySha256: jsonSha256(policyDocument as JsonValue)
  };
};

export const rewardBreakdown = (
  model: ProjectScopedRewardDecisionModelV4,
  currentProgressPpm: number,
  successorProgressPpm: number,
  transition: Pick<DecisionTransitionV4, "penaltyClass" | "target">
): RewardBreakdown => {
  const actionCostMicros = model.reward.actionCostMicros;
  const terminalSuccessBonusMicros = transition.target.kind === "terminal" && transition.target.terminal === "success"
    ? model.reward.terminalSuccessBonusMicros : 0;
  const outcomePenaltyMicros = model.reward.outcomePenaltyMicros[transition.penaltyClass];
  const acceptanceProgressDeltaPpm = successorProgressPpm - currentProgressPpm;
  const currentPotential = statePotentialMicros(model, currentProgressPpm);
  const successorPotential = statePotentialMicros(model, successorProgressPpm);
  const discountedSuccessorPotential = multiplyPpm(successorPotential, model.discountPpm);
  const potentialDeltaMicros = discountedSuccessorPotential - currentPotential;
  return {
    terminalSuccessBonusMicros,
    actionCostMicros,
    outcomePenaltyMicros,
    acceptanceProgressDeltaPpm,
    potentialDeltaMicros,
    netRewardMicros: terminalSuccessBonusMicros - actionCostMicros - outcomePenaltyMicros + potentialDeltaMicros
  };
};

const statePotentialMicros = (model: ProjectScopedRewardDecisionModelV4, progressPpm: number): number =>
  multiplyPpm(model.reward.acceptanceProgressPotentialScaleMicros, progressPpm - probabilityScalePpm);

const qValue = (
  input: CompileRewardPolicyInput,
  row: DecisionActionModelRowV4,
  values: ReadonlyMap<string, number>
): number => {
  const currentProgress = input.acceptanceProgressPpmByState[row.stateId] ?? 0;
  const terms = [...row.successors].sort(compareTransitions).map((successor) => {
    const successorProgress = successor.target.kind === "state"
      ? input.acceptanceProgressPpmByState[successor.target.stateId] ?? 0
      : successor.target.terminal === "success" ? probabilityScalePpm : currentProgress;
    const immediate = rewardBreakdown(input.model, currentProgress, successorProgress, successor).netRewardMicros;
    const continuation = successor.target.kind === "state"
      ? multiplyPpm(values.get(successor.target.stateId)!, input.model.discountPpm) : 0;
    return multiplyPpm(immediate + continuation, successor.probabilityPpm);
  });
  return terms.reduce((sum, value) => sum + value, 0);
};

const rowsByState = (input: CompileRewardPolicyInput): Map<string, DecisionActionModelRowV4[]> => {
  const allowed = new Map(Object.entries(input.admissibleActionsByState)
    .map(([stateId, actions]) => [stateId, new Set(actions)]));
  const result = new Map<string, DecisionActionModelRowV4[]>();
  for (const row of [...input.model.stateActions].sort(compareRows)) {
    if (!allowed.get(row.stateId)?.has(row.actionId)) continue;
    result.set(row.stateId, [...(result.get(row.stateId) ?? []), row]);
  }
  return result;
};

const reverseReachable = (rows: ReadonlyMap<string, DecisionActionModelRowV4[]>): Set<string> => {
  const result = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [stateId, actions] of rows) if (!result.has(stateId) && actions.some(({ successors }) =>
      successors.some(({ target }) => target.kind === "terminal" || result.has(target.stateId)))) {
      result.add(stateId);
      changed = true;
    }
  }
  return result;
};

const selectedPolicyIsAbsorbing = (
  stateIds: readonly string[],
  policy: ReadonlyMap<string, DecisionActionModelRowV4>
): boolean => {
  const remaining = new Set(stateIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const stateId of [...remaining]) {
      const successors = policy.get(stateId)?.successors ?? [];
      if (successors.length > 0 && successors.some(({ target }) =>
        target.kind === "terminal" || !remaining.has(target.stateId))) {
        remaining.delete(stateId);
        changed = true;
      }
    }
  }
  return remaining.size === 0;
};

const multiplyPpm = (value: number, ppm: number): number => Math.round(value * ppm / probabilityScalePpm);
const compareRows = (left: DecisionActionModelRowV4, right: DecisionActionModelRowV4) =>
  left.stateId.localeCompare(right.stateId) || left.actionId.localeCompare(right.actionId);
const compareTransitions = (left: DecisionTransitionV4, right: DecisionTransitionV4) =>
  left.outcomeId.localeCompare(right.outcomeId) || JSON.stringify(left.target).localeCompare(JSON.stringify(right.target));
const failure = (
  status: Exclude<RewardMdpCompilerStatus, "compiled">,
  input: CompileRewardPolicyInput,
  message: string,
  iterations = 0,
  residualMicros = 0
): CompiledRewardPolicyV4 => ({
  version: 4,
  scope: input.scope,
  ...(input.graphNodeId ? { graphNodeId: input.graphNodeId } : {}),
  algorithm: "discounted_value_iteration_v4",
  status,
  initialStateId: input.model.initialStateId,
  stateIds: [...input.stateIds],
  actionIds: [...input.actionIds],
  states: [],
  iterations,
  residualMicros,
  modelSha256: input.modelSha256,
  message
});

export const outcomePenaltyMicros = (
  model: ProjectScopedRewardDecisionModelV4,
  penaltyClass: OutcomePenaltyClass
): number => model.reward.outcomePenaltyMicros[penaltyClass];
