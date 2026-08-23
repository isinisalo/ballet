import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  DecisionFeatureDefinitionV2,
  DecisionProjectionContextV2,
  DecisionRuntimeFact,
  DecisionStateV2,
  ProjectSspDecisionModelV2
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

export class DecisionStateProjectionError extends Error {
  readonly code = "decision_state_invalid";
  constructor(message: string) {
    super(message);
    this.name = "DecisionStateProjectionError";
  }
}

export const projectDecisionState = (
  model: ProjectSspDecisionModelV2,
  context: DecisionProjectionContextV2
): DecisionStateV2 => {
  const features = Object.fromEntries([...model.features]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((definition) => [definition.id, projectFeature(definition, context)]));
  const matches = model.states.filter((state) => model.features.every((feature) =>
    state.values[feature.id] === features[feature.id]));
  if (matches.length !== 1) throw new DecisionStateProjectionError(
    `Decision feature vector matched ${matches.length} state catalog rows; exactly one is required.`
  );
  return {
    stateId: matches[0]!.id,
    features,
    featureVectorSha256: jsonSha256(features as JsonValue),
    sourceStateRevision: context.stateRevision,
    evidenceRefs: [...new Set(context.evidenceRefs)].sort()
  };
};

const projectFeature = (
  definition: DecisionFeatureDefinitionV2,
  context: DecisionProjectionContextV2
): string => {
  const raw = definition.source.kind === "runtime"
    ? runtimeFact(definition.source.fact, context)
    : definition.source.kind === "project_state"
      ? jsonPointer(context.projectState, definition.source.pointer)
      : jsonPointer(context.authorizationFacts, definition.source.pointer);
  const value = raw === undefined ? definition.missingValue : scalarString(raw, definition.id);
  if (!definition.domain.includes(value)) throw new DecisionStateProjectionError(
    `Feature ${definition.id} produced value ${JSON.stringify(value)} outside its configured domain.`
  );
  return value;
};

const runtimeFact = (
  fact: DecisionRuntimeFact,
  context: DecisionProjectionContextV2
): JsonValue | undefined => {
  if (fact === "epoch_kind") return context.epochKind;
  if (fact === "previous_action_id") return context.previousActionId;
  if (fact === "previous_action_result") return context.previousActionResult;
  if (fact === "previous_outcome_id") return context.previousOutcomeId;
  if (fact === "action_invocation_count") return context.actionInvocationCount;
  return undefined;
};

const scalarString = (value: JsonValue, featureId: string): string => {
  if (value === null) return "null";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  throw new DecisionStateProjectionError(`Feature ${featureId} must project a scalar JSON value.`);
};

const jsonPointer = (value: JsonValue, pointer: string): JsonValue | undefined => {
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
};
