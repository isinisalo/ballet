import type { JsonPrimitive, JsonValue } from "../../shared/domain/automation.js";
import type {
  AdmissibleActionSetV4,
  DecisionGuardContextV4,
  ProjectScopedRewardDecisionStrategyV4
} from "../../shared/domain/decisionModel.js";

export function resolveAdmissibleActions(
  strategy: ProjectScopedRewardDecisionStrategyV4,
  stateId: string,
  ownedNodeIds: readonly string[],
  context: DecisionGuardContextV4
): AdmissibleActionSetV4 {
  const snapshot = new Set(ownedNodeIds);
  const rows = new Map(strategy.model.stateActions
    .filter((row) => row.stateId === stateId).map((row) => [row.actionId, row]));
  const all = [...new Set([...ownedNodeIds, ...rows.keys()])];
  const actionIds: string[] = [];
  const excludedActions: AdmissibleActionSetV4["excludedActions"] = [];
  for (const actionId of all) {
    const row = rows.get(actionId);
    const failedGuard = row?.guards.find((guard) => {
      const source = guard.source.kind === "authorization" ? context.authorization.facts : context.projectState;
      const projected = jsonPointer(source, guard.source.pointer);
      const value = isPrimitive(projected) ? projected : guard.missingValue;
      return !guard.allowedValues.some((allowed) => Object.is(allowed, value));
    });
    const reasonCode = !snapshot.has(actionId) ? "outside_snapshot" as const
      : !row ? "outside_state_model" as const
        : failedGuard?.source.kind === "authorization" ? "authorization_denied" as const
          : failedGuard ? "guard_denied" as const : undefined;
    if (reasonCode) excludedActions.push({ actionId, reasonCode });
    else actionIds.push(actionId);
  }
  return { actionIds, excludedActions };
}

export function resolveAllAdmissibleActions(
  strategy: ProjectScopedRewardDecisionStrategyV4,
  ownedNodeIds: readonly string[],
  context: DecisionGuardContextV4
): Record<string, string[]> {
  return Object.fromEntries(ownedNodeIds.map((stateId) => [
    stateId,
    resolveAdmissibleActions(strategy, stateId, ownedNodeIds, context).actionIds
  ]));
}

function jsonPointer(value: JsonValue, pointer: string): JsonValue | undefined {
  if (pointer === "") return value;
  let current: JsonValue | undefined = value;
  for (const token of pointer.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) return undefined;
      current = current[Number(token)];
    } else if (current !== null && typeof current === "object") current = current[token];
    else return undefined;
  }
  return current;
}

const isPrimitive = (value: JsonValue | undefined): value is JsonPrimitive =>
  value === null || ["string", "number", "boolean"].includes(typeof value);
