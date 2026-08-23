import type { PolicyPreviewResultV3, ProjectRewardDecisionStrategyV3 } from "@shared/api/workspace-contracts";

export const rewardUnitMicros = 1_000_000;
export const probabilityUnitPpm = 1_000_000;

type CompiledPolicy = NonNullable<NonNullable<PolicyPreviewResultV3["preview"]>["compiledPolicy"]>;
export type DecisionCompiledState = CompiledPolicy["states"][number];
export type DecisionStateDefinition = ProjectRewardDecisionStrategyV3["model"]["states"][number];
type StateDefinition = DecisionStateDefinition;

export interface DecisionModelView {
  compiled?: CompiledPolicy;
  currentStateId?: string;
  selectedStateId?: string;
  currentDefinition?: DecisionStateDefinition;
  selectedDefinition?: DecisionStateDefinition;
  selectedPolicyState?: DecisionCompiledState;
  selectedRow?: ProjectRewardDecisionStrategyV3["model"]["stateActions"][number];
  selectedActionId?: string;
  expectedReturnMicros?: number;
}

export type AcceptanceStatus = "pending" | "verified" | "invalidated";
export type ImpactTone = "rewarding" | "neutral" | "costly";

export interface TransitionImpact {
  completionBonusMicros: number;
  actionCostMicros: number;
  outcomePenaltyMicros: number;
  potentialDeltaMicros: number;
  netRewardMicros: number;
  tone: ImpactTone;
}

export function resolveDecisionModelView(
  strategy: ProjectRewardDecisionStrategyV3,
  preview: PolicyPreviewResultV3 | undefined,
  exploredStateId: string | undefined
): DecisionModelView {
  const payload = preview?.preview;
  const compiled = payload?.compiledPolicy;
  const currentStateId = payload?.state?.stateId ?? compiled?.states.at(0)?.stateId;
  const selectedStateId = resolveSelectedStateId(compiled, exploredStateId, currentStateId);
  const selectedPolicyState = compiled?.states.find(({ stateId }) => stateId === selectedStateId);
  return {
    compiled,
    currentStateId,
    selectedStateId,
    currentDefinition: strategy.model.states.find(({ id }) => id === currentStateId),
    selectedDefinition: strategy.model.states.find(({ id }) => id === selectedStateId),
    selectedPolicyState,
    selectedRow: findStateAction(strategy, selectedPolicyState),
    selectedActionId: payload?.selectedActionId,
    expectedReturnMicros: payload?.expectedReturnMicros
  };
}

export function acceptanceStatus(
  state: StateDefinition | undefined,
  obligationId: string
): AcceptanceStatus {
  if (state?.verifiedObligationIds.includes(obligationId)) return "verified";
  if (state?.invalidatedObligationIds.includes(obligationId)) return "invalidated";
  return "pending";
}

export function transitionImpact(
  strategy: ProjectRewardDecisionStrategyV3,
  current: StateDefinition,
  next: StateDefinition,
  outcomeId: string
): TransitionImpact {
  const penaltyClass = strategy.capabilityModel.outcomes.find(({ id }) => id === outcomeId)?.penaltyClass ?? "none";
  const completionBonusMicros = next.terminal === "success" ? strategy.model.reward.completionBonusMicros : 0;
  const actionCostMicros = strategy.model.reward.actionCostMicros;
  const outcomePenaltyMicros = strategy.model.reward.outcomePenaltyMicros[penaltyClass];
  const currentPotential = statePotentialMicros(strategy, current);
  const successorPotential = statePotentialMicros(strategy, next);
  const potentialDeltaMicros = multiplyPpm(successorPotential, strategy.model.discountPpm) - currentPotential;
  const netRewardMicros = completionBonusMicros - actionCostMicros - outcomePenaltyMicros + potentialDeltaMicros;
  return {
    completionBonusMicros,
    actionCostMicros,
    outcomePenaltyMicros,
    potentialDeltaMicros,
    netRewardMicros,
    tone: netRewardMicros > 0 ? "rewarding" : netRewardMicros < 0 ? "costly" : "neutral"
  };
}

export function formatRewardMicros(value: number, sign = false): string {
  const units = value / rewardUnitMicros;
  const absolute = Math.abs(units);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: absolute < 10 ? 2 : 1,
    minimumFractionDigits: 0
  }).format(absolute);
  if (value < 0) return `−${formatted}`;
  if (sign && value > 0) return `+${formatted}`;
  return formatted;
}

export function formatProbabilityPpm(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value / 10_000) + "%";
}

export function exactMicros(value: number): string {
  return `${value.toLocaleString("en-US")} micros`;
}

export function exactPpm(value: number): string {
  return `${value.toLocaleString("en-US")} ppm`;
}

export function relativeValueBucket(value: number, minimum: number, maximum: number): 0 | 1 | 2 | 3 | 4 {
  if (maximum === minimum) return 2;
  const ratio = (value - minimum) / (maximum - minimum);
  if (ratio < 0.2) return 0;
  if (ratio < 0.4) return 1;
  if (ratio < 0.6) return 2;
  if (ratio < 0.8) return 3;
  return 4;
}

export function relativeBarWidth(value: number, minimum: number, maximum: number): number {
  if (maximum === minimum) return 100;
  return 18 + 82 * ((value - minimum) / (maximum - minimum));
}

function statePotentialMicros(strategy: ProjectRewardDecisionStrategyV3, state: StateDefinition): number {
  return multiplyPpm(
    strategy.model.reward.progressPotentialScaleMicros,
    stateProgressPpm(strategy, state) - probabilityUnitPpm
  );
}

function stateProgressPpm(strategy: ProjectRewardDecisionStrategyV3, state: StateDefinition): number {
  const weights = new Map(strategy.model.acceptance.obligations.map(({ obligationId, weight }) => [obligationId, weight]));
  const total = strategy.model.acceptance.obligations.reduce((sum, { weight }) => sum + weight, 0);
  if (total === 0) return state.terminal === "success" ? probabilityUnitPpm : 0;
  const verified = state.verifiedObligationIds.reduce((sum, obligationId) => sum + (weights.get(obligationId) ?? 0), 0);
  return Math.round(verified * probabilityUnitPpm / total);
}

function multiplyPpm(value: number, ppm: number): number {
  return Math.round(value * ppm / probabilityUnitPpm);
}

function resolveSelectedStateId(
  compiled: CompiledPolicy | undefined,
  exploredStateId: string | undefined,
  currentStateId: string | undefined
): string | undefined {
  if (exploredStateId && compiled?.states.some(({ stateId }) => stateId === exploredStateId)) return exploredStateId;
  return currentStateId ?? compiled?.states.at(0)?.stateId;
}

function findStateAction(
  strategy: ProjectRewardDecisionStrategyV3,
  state: DecisionCompiledState | undefined
): ProjectRewardDecisionStrategyV3["model"]["stateActions"][number] | undefined {
  if (!state) return undefined;
  return strategy.model.stateActions.find(({ stateId, actionId }) =>
    stateId === state.stateId && actionId === state.selectedActionId);
}
