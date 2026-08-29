import type { EnvironmentDefinition } from "../../../shared/orchestration/environment.js";
import type { RefinementProposalSeed } from "../../../shared/orchestration/persistence.js";

export const resolveRefinementImpact = (
  environment: EnvironmentDefinition,
  files: RefinementProposalSeed["files"],
  targetActionId: string
): string[] => {
  const actionIds = new Set([targetActionId]);
  const skillIds = new Set(files.filter(({ relativePath }) => isSkillPath(relativePath))
    .map(({ resourceId }) => resourceId).filter((id): id is string => Boolean(id)));
  for (const state of environment.states) for (const action of state.actions) {
    if ([...skillIds].some((id) => action.validation.skillResources.includes(id) || action.work.skillResources.includes(id))) {
      actionIds.add(action.id);
    }
  }
  return [...actionIds].sort();
};

const isSkillPath = (relativePath: string): boolean => (
  relativePath.startsWith(".agents/skills/")
);

export const assertCompleteRefinementImpact = (
  environment: EnvironmentDefinition,
  input: Pick<RefinementProposalSeed, "files" | "targetActionId" | "impactScope">
): void => {
  const required = resolveRefinementImpact(environment, input.files, input.targetActionId);
  const value = input.impactScope as { actionIds?: unknown };
  const declared = Array.isArray(value.actionIds) && value.actionIds.every((id) => typeof id === "string")
    ? [...new Set(value.actionIds as string[])].sort() : [];
  if (JSON.stringify(required) !== JSON.stringify(declared)) {
    throw new Error(`Refinement impact is incomplete; required Actions: ${required.join(", ")}.`);
  }
};
