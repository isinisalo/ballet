import type Database from "better-sqlite3";
import type { EventStormingModelV1 } from "../../../shared/orchestration/eventStorming.js";
import type { GovernanceAgentId, ProjectConfigurationV25, ActionDefinition, EnvironmentDefinition, StateDefinition } from "../../../shared/orchestration/environment.js";
import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import { canonicalJson, type JsonValue } from "../../../shared/orchestration/primitives.js";
import { validateRunnableEnvironment } from "../../../shared/orchestration/gates.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";
import type { ProjectDefinitionService } from "../project/ProjectDefinitionService.js";
import { ProjectReferenceIndex, type DirectionDocumentKind, type ProjectDocumentKind } from "../project/ProjectReferenceIndex.js";
import type { UserStoryInput } from "../../../shared/orchestration/userStories.js";
import type { InvalidationKind } from "../../../shared/orchestration/httpContracts.js";

/** Project-local authoring; runtime and governance commands have separate owners. */
export class AuthoringController {
  constructor(
    private readonly dependencies: { project: ProjectDefinitionService; connection: () => Database.Database; now(): string },
    private readonly changed: (kind: InvalidationKind, entityId?: string) => void
  ) {}

  project(): unknown { return this.dependencies.project.projects.load(); }
  putProject(config: ProjectConfigurationV25, expectedHash: string | "absent"): unknown {
    const current = this.dependencies.project.projects.loadOptional();
    if (current && canonical(current.config.direction) !== canonical(config.direction)) {
      throw new ConflictError("Direction and Use Case mutations require their dedicated document commands.");
    }
    if (current && canonical(current.config.environment) !== canonical(config.environment)) {
      throw new ConflictError("Environment, State, and Action mutations require their dedicated commands.");
    }
    if (!current && config.direction.useCases.some(({ status }) => status === "approved")) {
      throw new ConflictError("Initial Use Cases must be draft and use the dedicated human approval command.");
    }
    const saved = this.dependencies.project.projects.save(config, expectedHash);
    this.changed("project_changed");
    if (!current || canonical(current.config.critic) !== canonical(config.critic)) this.changed("schedule_changed");
    return saved;
  }
  documents(kind: ProjectDocumentKind): unknown { return this.dependencies.project.documents.list(kind); }
  eventStorming() { return this.dependencies.project.eventStorming.read(); }
  saveEventStorming(value: EventStormingModelV1, expectedHash: string) {
    const saved = this.dependencies.project.eventStorming.save(value, expectedHash);
    this.changed("project_changed"); return saved;
  }
  userStories() { return this.dependencies.project.userStories.list(); }
  userStory(id: string) { return this.dependencies.project.userStories.require(id); }
  createUserStory(input: UserStoryInput) {
    const saved = this.dependencies.project.userStories.create(input);
    this.changed("project_changed", saved.value.id); return saved;
  }
  updateUserStory(id: string, input: UserStoryInput, expectedHash: string) {
    const saved = this.dependencies.project.userStories.update(id, input, expectedHash);
    this.changed("project_changed", id); return saved;
  }
  removeUserStory(id: string, expectedHash: string): void {
    this.dependencies.project.userStories.remove(id, expectedHash); this.changed("project_changed", id);
  }
  document(kind: ProjectDocumentKind, id: string): unknown {
    if (kind === "event-storming") return this.eventStorming();
    if (kind === "user-story") return this.userStory(id);
    const document = this.dependencies.project.documents.require(kind, id);
    if (kind === "instruction" || kind === "skill") return document;
    const config = this.dependencies.project.projects.load().config;
    return { ...document, value: directionValues(config, kind).find((value) => value.id === id) };
  }
  agents(): unknown {
    const loaded = this.dependencies.project.projects.load();
    return { configHash: loaded.configHash, agents: this.dependencies.project.agents.list().map((value) => {
      const { source, ...slot } = value; void source;
      return { ...slot, skillResources: slot.id === "ballet-critic-agent"
        ? loaded.config.critic.agent.skillResources : loaded.config.refinement.agent.skillResources };
    }) };
  }
  agent(id: GovernanceAgentId): unknown {
    const loaded = this.dependencies.project.projects.load();
    const { source, ...slot } = this.dependencies.project.agents.inspect(id); void source;
    return { ...slot, configHash: loaded.configHash,
      skillResources: id === "ballet-critic-agent"
        ? loaded.config.critic.agent.skillResources : loaded.config.refinement.agent.skillResources };
  }
  updateAgent(input: Parameters<ProjectDefinitionService["putAgent"]>[0]): unknown {
    const saved = this.dependencies.project.putAgent(input); this.changed("project_changed", input.id); return saved;
  }
  referenceIndex(): unknown {
    const config = this.dependencies.project.projects.load().config;
    const activeRunIds = (this.dependencies.connection().prepare(
      "SELECT environment_run_id FROM environment_runs WHERE status IN ('pending','running') ORDER BY environment_run_id"
    ).all() as Array<{ environment_run_id: string }>).map(({ environment_run_id }) => environment_run_id);
    const runReferences = (["goal", "adr", "constraint", "use-case", "instruction", "skill"] as const)
      .flatMap((kind) => this.dependencies.project.documents.list(kind).flatMap(({ id }) => {
        const runIds = this.dependencies.project.documents.runReferences(kind, id);
        return runIds.length > 0 ? [{ kind, id, runIds }] : [];
      }));
    return { entries: new ProjectReferenceIndex(config).entries(), runReferences, activeRunIds };
  }
  createResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    if (expectedHash !== "absent" || this.dependencies.project.documents.list(kind).some((item) => item.id === id)) {
      throw new ConflictError(`${kind} ${id} already exists.`);
    }
    return this.putResource(kind, id, content, expectedHash);
  }
  updateResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    if (expectedHash === "absent") throw new NotFoundError(`${kind} ${id} was not found.`);
    this.dependencies.project.documents.require(kind, id);
    return this.putResource(kind, id, content, expectedHash);
  }
  private putResource(kind: "instruction" | "skill", id: string, content: string, expectedHash: string | "absent"): unknown {
    const saved = this.dependencies.project.documents.put(kind, id, content, expectedHash);
    this.changed("project_changed", id); return saved;
  }
  removeResource(kind: "instruction" | "skill", id: string, expectedHash: string): void {
    const config = this.dependencies.project.projects.load().config;
    const blockers = new ProjectReferenceIndex(config).for(kind, id)
      .map(({ ownerType, ownerId, field }) => `${ownerType}:${ownerId}.${field}`);
    blockers.push(...this.dependencies.project.documents.runReferences(kind, id)
      .map((runId) => `environment-run:${runId}.snapshot`));
    this.dependencies.project.documents.remove(kind, id, expectedHash, blockers);
    this.changed("project_changed", id);
  }
  createDirection(input: Parameters<ProjectDefinitionService["putDirection"]>[0]): unknown {
    const loaded = this.dependencies.project.projects.load();
    if (input.expectedDocumentHash !== "absent"
      || directionValues(loaded.config, input.kind).some(({ id }) => id === input.id)
      || this.dependencies.project.documents.list(input.kind).some(({ id }) => id === input.id)) {
      throw new ConflictError(`${input.kind} ${input.id} already exists.`);
    }
    return this.putDirection(input);
  }
  updateDirection(input: Parameters<ProjectDefinitionService["putDirection"]>[0]): unknown {
    const loaded = this.dependencies.project.projects.load();
    if (input.expectedDocumentHash === "absent"
      || !directionValues(loaded.config, input.kind).some(({ id }) => id === input.id)) {
      throw new NotFoundError(`${input.kind} ${input.id} was not found.`);
    }
    this.dependencies.project.documents.require(input.kind, input.id);
    return this.putDirection(input);
  }
  private putDirection(input: Parameters<ProjectDefinitionService["putDirection"]>[0]): unknown {
    const saved = this.dependencies.project.putDirection(input); this.changed("project_changed", input.id); return saved;
  }
  removeDirection(input: Parameters<ProjectDefinitionService["removeDirection"]>[0]): unknown {
    const configHash = this.dependencies.project.removeDirection(input); this.changed("project_changed", input.id);
    return { configHash };
  }
  approveUseCase(id: string, hash: string, contentHash: string, actor: TrustedHumanActor): unknown {
    const configHash = this.dependencies.project.approveUseCase(id, hash, contentHash, actor, this.dependencies.now());
    this.changed("project_changed", id); return { configHash };
  }
  revokeUseCase(id: string, hash: string): unknown {
    const configHash = this.dependencies.project.revokeUseCase(id, hash);
    this.changed("project_changed", id); return { configHash };
  }
  environment(): unknown {
    const loaded = this.dependencies.project.projects.load();
    const activeRunIds = (this.dependencies.connection().prepare("SELECT environment_run_id FROM environment_runs WHERE status IN ('pending','running')").all() as Array<{ environment_run_id: string }>).map((row) => row.environment_run_id);
    return { environment: loaded.config.environment, configHash: loaded.configHash,
      readinessIssues: validateRunnableEnvironment(loaded.config.environment),
      activeRunIds, locked: activeRunIds.length > 0 };
  }
  putEnvironment(environment: EnvironmentDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    assertExactOrder(environment.states.map(({ id }) => id), loaded.config.environment.states.map(({ id }) => id), "Environment State");
    for (const state of environment.states) {
      const current = loaded.config.environment.states.find(({ id }) => id === state.id)!;
      if (canonical(state.actions) !== canonical(current.actions)) {
        throw new ConflictError("Action mutations require their dedicated commands.");
      }
    }
    const saved = this.dependencies.project.projects.save({ ...loaded.config, environment }, expectedConfigHash);
    this.changed("project_changed", environment.id); return saved;
  }
  state(id: string): unknown {
    const loaded = this.dependencies.project.projects.load();
    const state = loaded.config.environment.states.find((candidate) => candidate.id === id);
    if (!state) throw new NotFoundError(`State ${id} was not found.`);
    return { state, configHash: loaded.configHash };
  }
  createState(state: StateDefinition, expectedConfigHash: string): unknown {
    const saved = this.dependencies.project.actions.createState(state, expectedConfigHash);
    this.changed("project_changed", state.id); return saved;
  }
  updateState(state: StateDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const current = loaded.config.environment.states.find(({ id }) => id === state.id);
    if (!current) throw new NotFoundError(`State ${state.id} was not found.`);
    assertExactOrder(state.actions.map(({ id }) => id), current.actions.map(({ id }) => id), "State Action");
    if (canonical(state.actions) !== canonical(current.actions)) {
      throw new ConflictError("Action mutations require their dedicated commands.");
    }
    return this.saveState(loaded.config.environment.states, state, loaded.config.environment, expectedConfigHash);
  }
  removeState(id: string, expectedConfigHash: string): unknown {
    const saved = this.dependencies.project.actions.removeState(id, expectedConfigHash);
    this.changed("project_changed", id); return saved;
  }
  reorderStates(ids: string[], expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const current = loaded.config.environment.states;
    assertExactOrder(ids, current.map(({ id }) => id), "State");
    const byId = new Map(current.map((state) => [state.id, state]));
    return this.putEnvironment({ ...loaded.config.environment,
      states: ids.map((id, index) => ({ ...byId.get(id)!, order: index + 1 })) }, expectedConfigHash);
  }
  action(stateId: string, actionId: string): unknown {
    return this.dependencies.project.actions.action(stateId, actionId);
  }
  createAction(stateId: string, action: ActionDefinition, expectedConfigHash: string): unknown {
    const saved = this.dependencies.project.actions.createAction(stateId, action, expectedConfigHash);
    this.changed("project_changed", action.id); return saved;
  }
  updateAction(stateId: string, action: ActionDefinition, agents: {
    validationAgent: Parameters<ProjectDefinitionService["actions"]["updateAction"]>[2]["validationAgent"];
    workAgent: Parameters<ProjectDefinitionService["actions"]["updateAction"]>[2]["workAgent"];
  }, expectedConfigHash: string): unknown {
    const saved = this.dependencies.project.actions.updateAction(stateId, action, agents, expectedConfigHash);
    this.changed("project_changed", action.id); return saved;
  }
  removeAction(stateId: string, actionId: string, expectedConfigHash: string): unknown {
    const saved = this.dependencies.project.actions.removeAction(stateId, actionId, expectedConfigHash);
    this.changed("project_changed", actionId); return saved;
  }
  reprioritizeActions(stateId: string, ids: string[], expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const state = loaded.config.environment.states.find(({ id }) => id === stateId);
    if (!state) throw new NotFoundError(`State ${stateId} was not found.`);
    assertExactOrder(ids, state.actions.map(({ id }) => id), "Action");
    const byId = new Map(state.actions.map((action) => [action.id, action]));
    return this.saveState(loaded.config.environment.states,
      { ...state, actions: ids.map((id, index) => ({ ...byId.get(id)!, priority: index + 1 })) },
      loaded.config.environment, expectedConfigHash);
  }

  private requireConfigHash(expectedConfigHash: string): ReturnType<ProjectDefinitionService["projects"]["load"]> {
    const loaded = this.dependencies.project.projects.load();
    if (loaded.configHash !== expectedConfigHash) throw new ConflictError("Project Config optimistic hash is stale.");
    return loaded;
  }
  private saveState(states: StateDefinition[], state: StateDefinition,
    environment: EnvironmentDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireConfigHash(expectedConfigHash);
    const saved = this.dependencies.project.projects.save({ ...loaded.config,
      environment: { ...environment, states: replace(states, state) } }, expectedConfigHash);
    this.changed("project_changed", state.id);
    return saved;
  }
}

const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);
const replace = <T extends { id: string }>(values: T[], value: T): T[] =>
  [...values.filter(({ id }) => id !== value.id), value];
const assertExactOrder = (received: string[], current: string[], label: string): void => {
  if (received.length !== current.length || new Set(received).size !== received.length
    || received.some((id) => !current.includes(id))) {
    throw new ConflictError(`${label} reorder must contain every current ID exactly once.`);
  }
};
const directionValues = (
  config: ProjectConfigurationV25, kind: DirectionDocumentKind
) => kind === "goal" ? config.direction.goals : kind === "adr" ? config.direction.adrs
  : kind === "constraint" ? config.direction.constraints : config.direction.useCases;

