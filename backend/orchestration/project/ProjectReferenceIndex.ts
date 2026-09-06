import type { EventStormingModelV2 } from "../../../shared/orchestration/eventStorming.js";
import type { UserStoryV2 } from "../../../shared/orchestration/userStories.js";
import type { ProjectConfigurationV26 } from "../../../shared/orchestration/environment.js";

export type ProjectDocumentKind = "overview" | "adr" | "user-story" | "event-storming" | "instruction" | "skill";
export type ProjectReferenceKind = ProjectDocumentKind;

export interface ProjectReference {
  ownerType: string;
  ownerId: string;
  field: string;
}

export class ProjectReferenceIndex {
  private readonly references = new Map<string, ProjectReference[]>();

  constructor(config: ProjectConfigurationV26, stories: UserStoryV2[] = [], storm?: EventStormingModelV2) {
    for (const process of storm?.processes ?? []) {
      this.addMany("user-story", process.storyIds, "process", process.id, "storyIds");
      for (const step of process.steps) this.addMany("user-story", step.storyIds, "process-step", step.id, "storyIds");
    }
    for (const story of stories) this.addMany("adr", story.adrIds, "user-story", story.id, "adrIds");
    for (const state of config.environment.states) {
      for (const action of state.actions) {
        for (const [role, composition] of [["validation", action.validation], ["work", action.work]] as const) {
          this.addMany("skill", composition.skillResources, "action", action.id, `${role}.skillResources`);
        }
      }
    }
    for (const [role, composition] of [["critic", config.critic.agent], ["refinement", config.refinement.agent]] as const) {
      this.addMany("skill", composition.skillResources, role, role, "skillResources");
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
