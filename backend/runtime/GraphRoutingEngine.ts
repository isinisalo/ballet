import type { NodeResult, ProjectRepairNode } from "../../shared/domain/automation.js";
import type { OrchestratorNodeOutcome, OrchestrationScope, RepairNodeOutcome } from "../../shared/domain/runtime.js";

export type RouteResolution =
  | { kind: "dispatch"; target: string }
  | { kind: "complete"; result: NodeResult }
  | { kind: "retry_orchestrator" }
  | { kind: "delegate_repair" }
  | { kind: "needs_input" };

export const resolveOrchestratorOutcome = (input: {
  outcome: OrchestratorNodeOutcome;
  candidateKeys: readonly string[];
  attempt: number;
  maxAttempts: number;
  repairAvailable: boolean;
}): RouteResolution => {
  const { outcome } = input;
  if (outcome.state === "needs_input") {
    if (input.candidateKeys.length === 0 && !input.repairAvailable) return { kind: "needs_input" };
    return invalidResolution(input);
  }
  if (outcome.action === "dispatch") {
    return input.candidateKeys.includes(outcome.target)
      ? { kind: "dispatch", target: outcome.target }
      : invalidResolution(input);
  }
  if (outcome.action === "complete") {
    return input.candidateKeys.includes(`terminal:${outcome.result}`)
      ? { kind: "complete", result: outcome.result }
      : invalidResolution(input);
  }
  return input.repairAvailable ? { kind: "delegate_repair" } : invalidResolution(input);
};

const invalidResolution = (input: {
  attempt: number; maxAttempts: number; repairAvailable: boolean;
}): RouteResolution => input.attempt < input.maxAttempts
  ? { kind: "retry_orchestrator" }
  : input.repairAvailable ? { kind: "delegate_repair" } : { kind: "needs_input" };

export type ValidationResolution = "pass" | "retry_work" | "request_repair";
export const resolveValidation = (
  decision: NodeResult,
  workAttempt: number,
  maxRetries: number
): ValidationResolution => decision === "PASS"
  ? "pass"
  : workAttempt <= maxRetries ? "retry_work" : "request_repair";

export type RepairResolution =
  | { kind: "revalidate" }
  | { kind: "dispatch"; target: string }
  | { kind: "escalate" }
  | { kind: "needs_input" };

export const resolveRepairOutcome = (input: {
  outcome: RepairNodeOutcome;
  candidateKeys: readonly string[];
  scope: OrchestrationScope;
  parentEscalationAvailable: boolean;
}): RepairResolution => {
  const { outcome } = input;
  if (outcome.state === "needs_input") return { kind: "needs_input" };
  if (outcome.action === "revalidate") return { kind: "revalidate" };
  if (outcome.action === "dispatch") {
    return input.candidateKeys.includes(outcome.target)
      ? { kind: "dispatch", target: outcome.target }
      : { kind: "needs_input" };
  }
  return input.scope === "graph_node" && input.parentEscalationAvailable
    ? { kind: "escalate" }
    : { kind: "needs_input" };
};

export const hasRepairCapacity = (
  repair: ProjectRepairNode | undefined,
  attempt: number,
  depth: number
): boolean => Boolean(repair && attempt <= Math.min(3, repair.maxRepairAttempts)
  && depth <= Math.min(3, repair.maxRepairDepth));

