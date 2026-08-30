import type { CreateEnvironmentRunInput } from "../../../shared/orchestration/persistence.js";
import type { JsonValue } from "../../../shared/orchestration/primitives.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import type { StoredActionExecution, StoredEnvironmentRun } from "../../../shared/orchestration/persistenceRecords.js";

export interface ContinuationSeedInput {
  parent: StoredEnvironmentRun;
  parentActions: StoredActionExecution[];
  planned: CreateEnvironmentRunInput;
  targetActionId: string;
  impactActionIds: string[];
  refinementProposalId: string;
  refinementApprovalId: string;
  refinementCommitSha: string;
}

export const planContinuationSeed = (input: ContinuationSeedInput): CreateEnvironmentRunInput => {
  if (!["completed", "blocked", "cancelled", "interrupted"].includes(input.parent.status)) {
    throw new Error("Continuation requires a terminal parent Environment Run.");
  }
  if (input.planned.baseCommit !== input.refinementCommitSha) throw new Error("Continuation base differs from refinement commit.");
  const impacted = new Set([...input.impactActionIds, input.targetActionId]);
  const prior = new Map(input.parentActions.map((action) => [action.actionDefinitionId, action]));
  const targetExists = input.planned.states.some(({ actions }) => actions.some(({ definition }) => definition.id === input.targetActionId));
  if (!targetExists) throw new Error(`Continuation target Action ${input.targetActionId} is absent.`);
  const snapshot = {
    ...input.planned.executionSnapshot,
    lineage: {
      parentRootRunId: input.parent.environmentRunId,
      refinementProposalId: input.refinementProposalId,
      refinementApprovalId: input.refinementApprovalId,
      refinementCommitSha: input.refinementCommitSha
    }
  };
  const states = input.planned.states.map((state) => ({
    ...state,
    actions: state.actions.map((action) => {
      const previous = prior.get(action.definition.id);
      const safe = previous?.status === "done" && previous.definitionSnapshotHash === action.definitionHash
        && !impacted.has(action.definition.id)
        && relevantExecutionContextHash(input.parent, action.definition.id)
          === relevantExecutionContextHash({ executionSnapshot: snapshot }, action.definition.id);
      return safe ? {
        ...action,
        originatingRunId: input.parent.environmentRunId,
        priorActionExecutionId: previous.actionExecutionId,
        importedDoneEvidence: {
          sourceRunId: input.parent.environmentRunId,
          sourceActionExecutionId: previous.actionExecutionId,
          definitionHash: previous.definitionSnapshotHash,
          resourceHash: relevantExecutionContextHash(input.parent, action.definition.id)
        } as JsonValue
      } : action;
    })
  }));
  return {
    ...input.planned,
    source: "continuation",
    previousRunId: input.parent.environmentRunId,
    executionSnapshot: snapshot,
    executionSnapshotHash: contentHash(snapshot),
    states
  };
};

const relevantExecutionContextHash = (
  source: Pick<StoredEnvironmentRun, "executionSnapshot">,
  actionId: string
): string => {
  const action = source.executionSnapshot.environment.states.flatMap(({ actions }) => actions).find(({ id }) => id === actionId);
  if (!action) return "missing";
  const ids = new Set([
    action.validation.instructionResource, ...action.validation.skillResources,
    action.work.instructionResource, ...action.work.skillResources
  ]);
  const state = source.executionSnapshot.environment.states.find(({ actions }) => actions.some(({ id }) => id === actionId));
  const useCaseIds = new Set(state?.useCaseIds ?? []);
  return contentHash({
    directionSha256: source.executionSnapshot.directionSha256,
    useCases: source.executionSnapshot.approvedUseCases.filter(({ useCase }) => useCaseIds.has(useCase.id))
      .map(({ useCase, contentSha256 }) => ({ id: useCase.id, contentSha256 })),
    capabilities: source.executionSnapshot.runtimeCapabilities.filter(({ subject }) => subject.kind === "action" && subject.actionId === actionId),
    permissions: source.executionSnapshot.permissions.filter(({ actionId: scopedActionId }) => !scopedActionId || scopedActionId === actionId),
    resources: source.executionSnapshot.resources.filter(({ id }) => ids.has(id)).map(
      ({ kind, id, sourceSha256 }) => ({ kind, id, sourceSha256 })
    )
  });
};
const contentHash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));
