import type {
  DecisionActionModelRowV4,
  DecisionTransitionV4,
  ProjectScopedRewardDecisionStrategyV4
} from "@shared/api/workspace-contracts";

export const rewardUnitMicros = 1_000_000;
export const probabilityUnitPpm = 1_000_000;
export type ImpactTone = "rewarding" | "neutral" | "costly" | "estimated";

export interface TransitionImpact {
  terminalSuccessBonusMicros: number;
  actionCostMicros: number;
  outcomePenaltyMicros: number;
  potentialDeltaMicros: number;
  netRewardMicros: number;
}

export function transitionImpact(
  strategy: ProjectScopedRewardDecisionStrategyV4,
  row: DecisionActionModelRowV4,
  branch: DecisionTransitionV4,
  progressByState: Readonly<Record<string, number>>
): TransitionImpact {
  const currentProgress = progressByState[row.stateId] ?? 0;
  const successorProgress = branch.target.kind === "state"
    ? progressByState[branch.target.stateId] ?? currentProgress
    : branch.target.terminal === "success" ? probabilityUnitPpm : currentProgress;
  const currentPotential = statePotentialMicros(strategy, currentProgress);
  const successorPotential = statePotentialMicros(strategy, successorProgress);
  const terminalSuccessBonusMicros = branch.target.kind === "terminal" && branch.target.terminal === "success"
    ? strategy.model.reward.terminalSuccessBonusMicros : 0;
  const actionCostMicros = strategy.model.reward.actionCostMicros;
  const outcomePenaltyMicros = strategy.model.reward.outcomePenaltyMicros[branch.penaltyClass];
  const potentialDeltaMicros = multiplyPpm(successorPotential, strategy.model.discountPpm) - currentPotential;
  return {
    terminalSuccessBonusMicros,
    actionCostMicros,
    outcomePenaltyMicros,
    potentialDeltaMicros,
    netRewardMicros: terminalSuccessBonusMicros - actionCostMicros - outcomePenaltyMicros + potentialDeltaMicros
  };
}

export function expectedImmediateReward(
  strategy: ProjectScopedRewardDecisionStrategyV4,
  row: DecisionActionModelRowV4,
  progressByState: Readonly<Record<string, number>>
): number {
  return row.successors.reduce((sum, branch) => sum
    + multiplyPpm(transitionImpact(strategy, row, branch, progressByState).netRewardMicros, branch.probabilityPpm), 0);
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

export function exactMicros(value: number): string { return `${value.toLocaleString("en-US")} micros`; }
export function exactPpm(value: number): string { return `${value.toLocaleString("en-US")} ppm`; }

export function rewardTone(value: number, estimated = false): ImpactTone {
  if (estimated) return "estimated";
  if (value > 0) return "rewarding";
  if (value < 0) return "costly";
  return "neutral";
}

function statePotentialMicros(strategy: ProjectScopedRewardDecisionStrategyV4, progressPpm: number): number {
  return multiplyPpm(
    strategy.model.reward.acceptanceProgressPotentialScaleMicros,
    progressPpm - probabilityUnitPpm
  );
}

function multiplyPpm(value: number, ppm: number): number {
  return Math.round(value * ppm / probabilityUnitPpm);
}
