import type { JsonValue } from "../../shared/domain/automation.js";
import {
  maxDecisionActionsPerState,
  maxDecisionStates,
  maxDecisionTransitions,
  sspProbabilityScale,
  type DecisionOptionModelRowV1,
  type ProjectSspDecisionModelV1,
  type SspPolicySolutionV1,
  type SspSolverStatus
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

export interface SolvePolicyInput {
  model: ProjectSspDecisionModelV1;
  currentStateId: string;
  admissibleActionsByState: Readonly<Record<string, readonly string[]>>;
  modelSha256: string;
}

export const solvePolicy = (input: SolvePolicyInput): SspPolicySolutionV1 => {
  const invalid = validateInput(input);
  if (invalid) return failure("policy_model_invalid", input, invalid);
  const states = [...input.model.states].sort((left, right) => left.id.localeCompare(right.id));
  const stateById = new Map(states.map((state) => [state.id, state]));
  const goals = new Set(states.filter((state) => state.terminal === "success").map((state) => state.id));
  const rows = rowsByState(input);
  const reachable = reverseReachable(goals, rows);
  if (!reachable.has(input.currentStateId)) {
    return failure("policy_goal_unreachable", input, `Success is unreachable from state ${input.currentStateId}.`);
  }
  const winning = almostSureWinning(states.map(({ id }) => id), goals, stateById, rows);
  if (!winning.has(input.currentStateId)) {
    return failure("policy_no_proper_policy", input, `No proper policy reaches success almost surely from state ${input.currentStateId}.`);
  }
  const usable = new Map([...rows].map(([stateId, candidates]) => [stateId,
    candidates.filter((row) => row.successors.every((successor) => winning.has(successor.nextStateId)))
  ]));
  const values = new Map([...winning].map((stateId) => [stateId, 0]));
  const started = performance.now();
  let residual = 0;
  let iterations = 0;
  for (iterations = 1; iterations <= input.model.solver.maxIterations; iterations += 1) {
    const next = new Map(values);
    residual = 0;
    for (const state of states) {
      if (!winning.has(state.id) || goals.has(state.id)) continue;
      const qValues = (usable.get(state.id) ?? []).map((row) => qValue(row, values));
      if (qValues.length === 0 || qValues.some((value) => !Number.isFinite(value))) {
        return failure("policy_no_proper_policy", input, `State ${state.id} has no finite proper action.`, iterations, residual);
      }
      const value = Math.min(...qValues);
      residual = Math.max(residual, Math.abs(value - values.get(state.id)!));
      next.set(state.id, value);
    }
    for (const [stateId, value] of next) values.set(stateId, value);
    if (!Number.isFinite(residual)) return failure("policy_model_invalid", input, "Solver produced a non-finite residual.", iterations, 0);
    if (residual <= input.model.solver.epsilon) break;
    if (performance.now() - started > input.model.solver.maxSolveMillis) {
      return failure("policy_not_converged", input, "Solver time bound was exceeded.", iterations, residual, values);
    }
  }
  if (residual > input.model.solver.epsilon || iterations > input.model.solver.maxIterations) {
    return failure("policy_not_converged", input, "Bellman value iteration did not converge within its bound.",
      Math.min(iterations, input.model.solver.maxIterations), residual, values);
  }
  const policy = selectPolicy(states.map(({ id }) => id), goals, usable, values, input.model.solver.epsilon);
  if (!selectedPolicyIsProper(input.currentStateId, goals, policy.selectedRows)) {
    return failure("policy_no_proper_policy", input, "The converged selected policy has a non-goal recurrent class.", iterations, residual, values);
  }
  const currentRows = usable.get(input.currentStateId) ?? [];
  const actionValues = currentRows.map((row) => ({ graphNodeId: row.graphNodeId, qMicros: qValue(row, values) }))
    .sort((left, right) => left.graphNodeId.localeCompare(right.graphNodeId));
  const minimum = Math.min(...actionValues.map(({ qMicros }) => qMicros));
  const tiedActionIds = actionValues.filter(({ qMicros }) => Math.abs(qMicros - minimum) <= input.model.solver.epsilon)
    .map(({ graphNodeId }) => graphNodeId).sort();
  const stateValues = Object.fromEntries([...values].sort(([left], [right]) => left.localeCompare(right)));
  const policyDocument = Object.fromEntries([...policy.selectedRows].sort(([left], [right]) => left.localeCompare(right))
    .map(([stateId, row]) => [stateId, row.graphNodeId]));
  return {
    status: "converged", selectedActionId: tiedActionIds[0], actionValues, stateValues,
    stateValueMicros: values.get(input.currentStateId), tiedActionIds, iterations, residual,
    epsilon: input.model.solver.epsilon, modelVersion: input.model.version, modelSha256: input.modelSha256,
    policySha256: jsonSha256(policyDocument as JsonValue)
  };
};

const validateInput = (input: SolvePolicyInput): string | undefined => {
  if (input.model.states.length > maxDecisionStates) return `Decision Model exceeds the ${maxDecisionStates} state limit.`;
  if (input.model.stateActions.reduce((sum, row) => sum + row.successors.length, 0) > maxDecisionTransitions) {
    return `Decision Model exceeds the ${maxDecisionTransitions} transition outcome limit.`;
  }
  const states = new Set(input.model.states.map(({ id }) => id));
  if (states.size !== input.model.states.length) return "Decision state IDs must be unique.";
  if (!states.has(input.currentStateId)) return `Unknown current state ${input.currentStateId}.`;
  if (!input.model.states.some((state) => state.terminal === "success")) return "The model has no success terminal.";
  const rowKeys = new Set<string>();
  const rowCounts = new Map<string, number>();
  for (const row of input.model.stateActions) {
    if (!states.has(row.stateId)) return `Action row references unknown state ${row.stateId}.`;
    if (input.model.states.find(({ id }) => id === row.stateId)?.terminal) return `Terminal state ${row.stateId} cannot have actions.`;
    const rowKey = `${row.stateId}\u0000${row.graphNodeId}`;
    if (rowKeys.has(rowKey)) return `Duplicate state/action row ${row.stateId}/${row.graphNodeId}.`;
    rowKeys.add(rowKey);
    const rowCount = (rowCounts.get(row.stateId) ?? 0) + 1;
    rowCounts.set(row.stateId, rowCount);
    if (rowCount > maxDecisionActionsPerState) return `State ${row.stateId} exceeds the ${maxDecisionActionsPerState} action limit.`;
    if (!Number.isSafeInteger(row.expectedCostMicros) || row.expectedCostMicros <= 0) return "Expected costs must be positive safe integers.";
    if (new Set(row.successors.map(({ nextStateId }) => nextStateId)).size !== row.successors.length) return "Transition successors must be unique.";
    if (row.successors.some(({ nextStateId, probabilityPpm }) => !states.has(nextStateId)
      || !Number.isSafeInteger(probabilityPpm) || probabilityPpm <= 0)) return "Transition probabilities or successors are invalid.";
    if (row.successors.reduce((sum, { probabilityPpm }) => sum + probabilityPpm, 0) !== sspProbabilityScale) {
      return `Transition probabilities for ${row.stateId}/${row.graphNodeId} do not sum to ${sspProbabilityScale}.`;
    }
  }
  return undefined;
};

const rowsByState = (input: SolvePolicyInput): Map<string, DecisionOptionModelRowV1[]> => {
  const allowed = new Map(Object.entries(input.admissibleActionsByState)
    .map(([stateId, actions]) => [stateId, new Set(actions)]));
  const rows = new Map<string, DecisionOptionModelRowV1[]>();
  for (const row of [...input.model.stateActions].sort((left, right) => left.stateId.localeCompare(right.stateId)
    || left.graphNodeId.localeCompare(right.graphNodeId))) {
    if (!allowed.get(row.stateId)?.has(row.graphNodeId)) continue;
    rows.set(row.stateId, [...(rows.get(row.stateId) ?? []), row]);
  }
  return rows;
};

const reverseReachable = (goals: Set<string>, rows: Map<string, DecisionOptionModelRowV1[]>): Set<string> => {
  const result = new Set(goals);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [stateId, actions] of rows) if (!result.has(stateId)
      && actions.some((action) => action.successors.some(({ nextStateId }) => result.has(nextStateId)))) {
      result.add(stateId); changed = true;
    }
  }
  return result;
};

const almostSureWinning = (
  stateIds: string[], goals: Set<string>, stateById: Map<string, { terminal?: string }>, rows: Map<string, DecisionOptionModelRowV1[]>
): Set<string> => {
  let candidate = new Set(stateIds.filter((id) => !stateById.get(id)?.terminal || goals.has(id)));
  while (true) {
    const attractor = new Set([...goals].filter((id) => candidate.has(id)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const stateId of candidate) if (!attractor.has(stateId) && (rows.get(stateId) ?? []).some((action) =>
        action.successors.every(({ nextStateId }) => candidate.has(nextStateId))
        && action.successors.some(({ nextStateId }) => attractor.has(nextStateId)))) {
        attractor.add(stateId); changed = true;
      }
    }
    if (attractor.size === candidate.size) return attractor;
    candidate = attractor;
  }
};

const qValue = (row: DecisionOptionModelRowV1, values: Map<string, number>): number => {
  let sum = 0;
  let compensation = 0;
  for (const successor of [...row.successors].sort((left, right) => left.nextStateId.localeCompare(right.nextStateId))) {
    const term = successor.probabilityPpm / sspProbabilityScale * (values.get(successor.nextStateId) ?? Number.POSITIVE_INFINITY);
    const adjusted = term - compensation;
    const next = sum + adjusted;
    compensation = next - sum - adjusted;
    sum = next;
  }
  return row.expectedCostMicros + sum;
};

const selectPolicy = (
  stateIds: string[], goals: Set<string>, rows: Map<string, DecisionOptionModelRowV1[]>, values: Map<string, number>, epsilon: number
) => {
  const selectedRows = new Map<string, DecisionOptionModelRowV1>();
  for (const stateId of [...stateIds].sort()) {
    if (goals.has(stateId)) continue;
    const ranked = (rows.get(stateId) ?? []).map((row) => ({ row, q: qValue(row, values) }))
      .sort((left, right) => left.q - right.q || left.row.graphNodeId.localeCompare(right.row.graphNodeId));
    if (ranked.length === 0) continue;
    const minimum = ranked[0]!.q;
    selectedRows.set(stateId, ranked.filter(({ q }) => Math.abs(q - minimum) <= epsilon)
      .sort((left, right) => left.row.graphNodeId.localeCompare(right.row.graphNodeId))[0]!.row);
  }
  return { selectedRows };
};

const selectedPolicyIsProper = (
  current: string, goals: Set<string>, policy: Map<string, DecisionOptionModelRowV1>
): boolean => {
  const reachable = new Set<string>();
  const queue = [current];
  while (queue.length) {
    const state = queue.pop()!;
    if (reachable.has(state)) continue;
    reachable.add(state);
    for (const successor of policy.get(state)?.successors ?? []) queue.push(successor.nextStateId);
  }
  const remaining = new Set([...reachable].filter((state) => !goals.has(state)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const state of [...remaining]) if ((policy.get(state)?.successors ?? []).some((successor) =>
      goals.has(successor.nextStateId) || !remaining.has(successor.nextStateId))) {
      remaining.delete(state); changed = true;
    }
  }
  return remaining.size === 0;
};

const failure = (
  status: Exclude<SspSolverStatus, "converged">, input: SolvePolicyInput, message: string,
  iterations = 0, residual = 0, values: Map<string, number> = new Map()
): SspPolicySolutionV1 => ({
  status, actionValues: [], stateValues: Object.fromEntries([...values].filter(([, value]) => Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right))), tiedActionIds: [], iterations, residual,
  epsilon: input.model.solver.epsilon, modelVersion: input.model.version, modelSha256: input.modelSha256, message
});
