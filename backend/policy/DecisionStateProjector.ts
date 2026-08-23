import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  DecisionFeatureDefinitionV3,
  DecisionProjectionContextV3,
  DecisionRuntimeFact,
  DecisionStateV3,
  ProjectRewardDecisionModelV3
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { stateProgressPpm } from "./RewardMdpCompiler.js";

export class DecisionStateProjectionError extends Error {
  readonly code = "decision_state_invalid";
  constructor(message: string) {
    super(message);
    this.name = "DecisionStateProjectionError";
  }
}

export function projectDecisionState(
  model: ProjectRewardDecisionModelV3,
  context: DecisionProjectionContextV3
): DecisionStateV3 {
  const features = Object.fromEntries([...model.features].sort(byId)
    .map((definition) => [definition.id, projectFeature(definition, context)]));
  const verified = context.acceptanceLedger.entries.filter(({ status }) => status === "verified")
    .map(({ obligationId }) => obligationId).sort();
  const invalidated = context.acceptanceLedger.entries.filter(({ status }) => status === "invalidated")
    .map(({ obligationId }) => obligationId).sort();
  const matches = model.states.filter((state) => model.features.every((feature) =>
    state.values[feature.id] === features[feature.id])
    && equalIds(state.verifiedObligationIds, verified)
    && equalIds(state.invalidatedObligationIds, invalidated));
  if (matches.length !== 1) throw new DecisionStateProjectionError(
    `Decision projection matched ${matches.length} state rows; exactly one is required.`
  );
  const state = matches[0]!;
  return {
    stateId: state.id,
    features,
    verifiedProgressPpm: stateProgressPpm(model, state),
    featureVectorSha256: jsonSha256({ features, verified, invalidated } as JsonValue),
    sourceStateRevision: context.stateRevision,
    evidenceRefs: [...new Set(context.evidenceRefs)].sort()
  };
}

function projectFeature(definition: DecisionFeatureDefinitionV3, context: DecisionProjectionContextV3): string {
  const raw = definition.source.kind === "runtime"
    ? runtimeFact(definition.source.fact, context)
    : definition.source.kind === "project_state"
      ? jsonPointer(context.projectState, definition.source.pointer)
      : jsonPointer(context.authorization.facts, definition.source.pointer);
  const value = raw === undefined ? definition.missingValue : scalarString(raw, definition.id);
  if (!definition.domain.includes(value)) throw new DecisionStateProjectionError(
    `Feature ${definition.id} produced value ${JSON.stringify(value)} outside its configured domain.`
  );
  return value;
}

function runtimeFact(fact: DecisionRuntimeFact, context: DecisionProjectionContextV3): JsonValue | undefined {
  if (fact === "epoch_kind") return context.epochKind;
  if (fact === "previous_action_id") return context.previousActionId;
  if (fact === "previous_action_result") return context.previousActionResult;
  if (fact === "previous_outcome_id") return context.previousOutcomeId;
  if (fact === "action_invocation_count") return context.actionInvocationCount;
  return undefined;
}

function scalarString(value: JsonValue, featureId: string): string {
  if (value === null) return "null";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  throw new DecisionStateProjectionError(`Feature ${featureId} must project a scalar JSON value.`);
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

const byId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);
const equalIds = (left: string[], right: string[]) => JSON.stringify([...left].sort()) === JSON.stringify(right);
