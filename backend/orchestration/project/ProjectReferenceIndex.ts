import type { ProjectConfigurationV20 } from "../../../shared/orchestration/environment.js";

export type ProjectDocumentKind = "goal" | "adr" | "constraint" | "use-case" | "instruction" | "skill";
export type ProjectReferenceKind = ProjectDocumentKind | "execution-profile";

export interface ProjectReference {
  ownerType: string;
  ownerId: string;
  field: string;
}

export class ProjectReferenceIndex {
  private readonly references = new Map<string, ProjectReference[]>();

  constructor(config: ProjectConfigurationV20) {
    for (const useCase of config.direction.useCases) {
      this.addMany("goal", useCase.goalIds, "use-case", useCase.id, "goalIds");
      this.addMany("adr", useCase.adrIds, "use-case", useCase.id, "adrIds");
      this.addMany("constraint", useCase.constraintIds, "use-case", useCase.id, "constraintIds");
    }
    const addDirectionClosure = (ids: string[], ownerType: string, ownerId: string): void => {
      for (const id of ids) {
        const useCase = config.direction.useCases.find((candidate) => candidate.id === id);
        this.add("use-case", id, ownerType, ownerId, "directionClosure");
        if (!useCase) continue;
        this.addMany("goal", useCase.goalIds, ownerType, ownerId, "directionClosure");
        this.addMany("adr", useCase.adrIds, ownerType, ownerId, "directionClosure");
        this.addMany("constraint", useCase.constraintIds, ownerType, ownerId, "directionClosure");
      }
    };
    const environmentUseCaseIds = new Set(config.environment.states.flatMap((state) => [
      ...state.useCaseIds, ...state.actions.flatMap((action) => action.useCaseIds)
    ]));
    addDirectionClosure([...environmentUseCaseIds], "environment", config.environment.id);
    for (const state of config.environment.states) {
      addDirectionClosure(state.useCaseIds, "state", state.id);
      for (const action of state.actions) {
        addDirectionClosure(action.useCaseIds, "action", action.id);
        for (const [role, composition] of [["validation", action.validation], ["work", action.work]] as const) {
          this.add("instruction", composition.instructionResource, "action", action.id, `${role}.instructionResource`);
          this.addMany("skill", composition.skillResources, "action", action.id, `${role}.skillResources`);
          this.add("execution-profile", composition.executionProfileId, "action", action.id, `${role}.executionProfileId`);
        }
      }
    }
    for (const [role, composition] of [["critic", config.critic.agent], ["refinement", config.refinement.agent]] as const) {
      this.add("instruction", composition.instructionResource, role, role, "instructionResource");
      this.addMany("skill", composition.skillResources, role, role, "skillResources");
      this.add("execution-profile", composition.executionProfileId, role, role, "executionProfileId");
    }
  }

  for(kind: ProjectReferenceKind, id: string): ProjectReference[] {
    return [...(this.references.get(`${kind}:${id}`) ?? [])];
  }

  entries(): Array<{ kind: ProjectReferenceKind; id: string; references: ProjectReference[] }> {
    return [...this.references.entries()].map(([key, references]) => {
      const separator = key.indexOf(":");
      return { kind: key.slice(0, separator) as ProjectReferenceKind, id: key.slice(separator + 1), references: [...references] };
    }).sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
  }

  private addMany(kind: ProjectReferenceKind, ids: string[], ownerType: string, ownerId: string, field: string): void {
    for (const id of ids) this.add(kind, id, ownerType, ownerId, field);
  }

  private add(kind: ProjectReferenceKind, id: string, ownerType: string, ownerId: string, field: string): void {
    const key = `${kind}:${id}`;
    this.references.set(key, [...(this.references.get(key) ?? []), { ownerType, ownerId, field }]);
  }
}
