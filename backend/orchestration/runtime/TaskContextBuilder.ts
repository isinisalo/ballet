import type { ActionDefinition, ActionRoleComposition, StateDefinition } from "../../../shared/orchestration/environment.js";
import type { JsonValue } from "../../../shared/orchestration/primitives.js";
import type { RootSnapshotV18 } from "../../../shared/orchestration/runtime.js";

export interface BoundedTaskContextInput {
  snapshot: RootSnapshotV18;
  state?: StateDefinition;
  action?: ActionDefinition;
  composition: ActionRoleComposition;
  actionStatus?: string;
  workAttempt?: number;
  maxRetries?: number;
  humanInput?: string;
  history?: JsonValue[];
  previousEvidence?: JsonValue;
  approvalBoundary?: JsonValue;
  outputSchemaId: string;
}

export const buildBoundedTaskContext = (input: BoundedTaskContextInput): JsonValue => {
  const useCaseIds = new Set(input.state?.useCaseIds ?? []);
  const useCases = input.snapshot.approvedUseCases.filter(({ useCase }) => useCaseIds.has(useCase.id));
  const goalIds = new Set(useCases.flatMap(({ useCase }) => useCase.goalIds));
  const adrIds = new Set(useCases.flatMap(({ useCase }) => useCase.adrIds));
  const constraintIds = new Set(useCases.flatMap(({ useCase }) => useCase.constraintIds));
  const resourceIds = new Set([input.composition.instructionResource, ...input.composition.skillResources]);
  const context = {
    definitions: {
      environment: { id: input.snapshot.environment.id, sha256: input.snapshot.environmentSha256 },
      ...(input.state ? { state: input.state } : {}),
      ...(input.action ? { action: input.action } : {})
    },
    direction: {
      useCases,
      goals: input.snapshot.direction.goals.filter(({ id }) => goalIds.has(id)),
      adrs: input.snapshot.direction.adrs.filter(({ id }) => adrIds.has(id)),
      constraints: input.snapshot.direction.constraints.filter(({ id }) => constraintIds.has(id))
    },
    resources: input.snapshot.resources.filter(({ id }) => resourceIds.has(id)).map(
      ({ kind, id, relativePath, sourceSha256 }) => ({ kind, id, relativePath, sourceSha256 })
    ),
    runtime: {
      actionStatus: input.actionStatus ?? null,
      workAttempt: input.workAttempt ?? 0,
      maxRetries: input.maxRetries ?? 0,
      humanInput: input.humanInput ?? null,
      history: (input.history ?? []).slice(-16),
      previousEvidence: input.previousEvidence ?? null
    },
    approvalBoundary: input.approvalBoundary ?? { humanDecisionRequired: false },
    outputContract: { version: 11, schemaId: input.outputSchemaId }
  };
  return JSON.parse(JSON.stringify(context)) as JsonValue;
};
