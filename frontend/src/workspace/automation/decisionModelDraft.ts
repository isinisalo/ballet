import type { ProjectIntrinsicOutcome, ProjectSspDecisionStrategyV2 } from "@shared/api/workspace-contracts";

export const createSspDraft = (scopeKey: string, actionContracts: Array<{ id: string; outcomes: ProjectIntrinsicOutcome[] }>): ProjectSspDecisionStrategyV2 => {
  const outcomeIds = [...new Set(actionContracts.flatMap(({ outcomes }) => outcomes.map(({ outcomeId }) => outcomeId)))].sort();
  return {
    kind: "ssp_v2", id: `${scopeKey}-policy`, description: `Outcome-aware finite SSP policy for ${scopeKey}.`,
    capabilityModel: {
      version: 2,
      outcomes: outcomeIds.map((id) => ({ id, description: `Calibrate the meaning of ${id} before Run.` })),
      actions: actionContracts.map(({ id }) => ({ actionId: id, guards: [] }))
    },
    model: {
      version: 2, features: [], states: [], stateActions: [],
      solver: { algorithm: "ssp_value_iteration_v2", epsilon: 0.000001, maxIterations: 1_000, maxSolveMillis: 250 },
      projection: { maxDecisionEpochs: 8, maxProjectionNodes: 64 }
    }
  };
};
