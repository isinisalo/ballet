import type {
  ActionAgentDefinition, ActionDefinition, ActionAgentRole, ProjectConfigurationV26, StateDefinition
} from "../../../shared/orchestration/environment.js";
import { actionAgentId } from "../../../shared/orchestration/environment.js";
import type { ProjectConfigurationRepository } from "./ProjectConfigurationRepository.js";
import type { CodexAgentRepository } from "./CodexAgentRepository.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";

export type ActionAgentAuthoring = Omit<ActionAgentDefinition, "id" | "name"> & { expectedDocumentHash: string };

export class ActionAgentMutationService {
  constructor(private readonly projects: ProjectConfigurationRepository, private readonly agents: CodexAgentRepository) {}

  action(stateId: string, actionId: string): unknown {
    const loaded = this.projects.load(); const action = requireAction(loaded.config, stateId, actionId);
    return { action, configHash: loaded.configHash,
      validationAgent: publicSlot(this.agents.requireAction(action.validation.agentId)),
      workAgent: publicSlot(this.agents.requireAction(action.work.agentId)) };
  }

  createState(state: StateDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireHash(expectedConfigHash);
    if (loaded.config.environment.states.some(({ id }) => id === state.id)) throw new ConflictError(`State ${state.id} already exists.`);
    const writes = state.actions.flatMap((action) => this.starterWrites(action));
    return this.mutate(loaded.config, { ...loaded.config, environment: { ...loaded.config.environment,
      states: [...loaded.config.environment.states, state] } }, writes, [], expectedConfigHash);
  }

  createAction(stateId: string, action: ActionDefinition, expectedConfigHash: string): unknown {
    const loaded = this.requireHash(expectedConfigHash); const state = requireState(loaded.config, stateId);
    if (state.actions.some(({ id }) => id === action.id)) throw new ConflictError(`Action ${action.id} already exists.`);
    const next = replaceState(loaded.config, { ...state, actions: [...state.actions, action] });
    return this.mutate(loaded.config, next, this.starterWrites(action), [], expectedConfigHash);
  }

  updateAction(stateId: string, action: ActionDefinition, input: {
    validationAgent: ActionAgentAuthoring; workAgent: ActionAgentAuthoring;
  }, expectedConfigHash: string): unknown {
    const loaded = this.requireHash(expectedConfigHash); const state = requireState(loaded.config, stateId);
    if (!state.actions.some(({ id }) => id === action.id)) throw new NotFoundError(`Action ${action.id} was not found.`);
    const next = replaceState(loaded.config, { ...state, actions: replace(state.actions, action) });
    return this.mutate(loaded.config, next, [
      write(action, "validation", input.validationAgent), write(action, "work", input.workAgent)
    ], [], expectedConfigHash);
  }

  removeAction(stateId: string, actionId: string, expectedConfigHash: string): unknown {
    const loaded = this.requireHash(expectedConfigHash); const state = requireState(loaded.config, stateId);
    const action = requireAction(loaded.config, stateId, actionId);
    const next = replaceState(loaded.config, { ...state, actions: state.actions.filter(({ id }) => id !== actionId) });
    return this.mutate(loaded.config, next, [], [action.validation.agentId, action.work.agentId], expectedConfigHash);
  }

  removeState(stateId: string, expectedConfigHash: string): unknown {
    const loaded = this.requireHash(expectedConfigHash); const state = requireState(loaded.config, stateId);
    const next = { ...loaded.config, environment: { ...loaded.config.environment,
      states: loaded.config.environment.states.filter(({ id }) => id !== stateId) } };
    return this.mutate(loaded.config, next, [], state.actions.flatMap((action) => [
      action.validation.agentId, action.work.agentId
    ]), expectedConfigHash);
  }

  private starterWrites(action: ActionDefinition): AgentWrite[] {
    return (["validation", "work"] as const).map((role) => ({ id: actionAgentId(action.id, role), expectedHash: "absent",
      value: starterAgent(action, role) }));
  }

  private mutate(before: ProjectConfigurationV26, after: ProjectConfigurationV26, writes: AgentWrite[], deletes: string[], expectedHash: string): unknown {
    this.projects.assertUnlocked();
    const ids = [...new Set([...writes.map(({ id }) => id), ...deletes])];
    const snapshots = new Map(ids.map((id) => [id, this.agents.inspectAction(id)]));
    for (const write of writes) {
      const current = snapshots.get(write.id)!;
      if (write.expectedHash === "absent" ? current.status !== "missing" : current.contentHash !== write.expectedHash) {
        throw new ConflictError(`Agent ${write.id} optimistic hash is stale.`);
      }
    }
    for (const id of deletes) this.agents.requireAction(id);
    const saved = this.projects.save(after, expectedHash);
    try {
      for (const write of writes) this.agents.putAction(write.id, { ...write.value, expectedHash: write.expectedHash });
      for (const id of deletes) this.agents.removeAction(id, snapshots.get(id)!.contentHash!);
      this.agents.requireActionSet(after.environment.states.flatMap((state) => state.actions.flatMap((action) => [
        action.validation.agentId, action.work.agentId
      ])));
      return saved;
    } catch (error) {
      this.projects.save(before, saved.configHash);
      for (const [id, snapshot] of snapshots) {
        const current = this.agents.inspectAction(id);
        if (snapshot.status === "ready" && snapshot.source !== undefined) this.agents.restore(id, snapshot.source);
        else if (snapshot.status === "missing" && current.status === "ready" && current.contentHash) this.agents.removeAction(id, current.contentHash);
      }
      throw error;
    }
  }

  private requireHash(expectedHash: string) {
    const loaded = this.projects.load(); if (loaded.configHash !== expectedHash) throw new ConflictError("Project Config optimistic hash is stale.");
    return loaded;
  }
}

type AgentWrite = { id: string; expectedHash: string | "absent"; value: Omit<ActionAgentDefinition, "id" | "name"> };
const write = (action: ActionDefinition, role: ActionAgentRole, value: ActionAgentAuthoring): AgentWrite => {
  if (action[role].agentId !== actionAgentId(action.id, role)) throw new ConflictError(`${role} Agent id differs from Action ${action.id}.`);
  const { expectedDocumentHash, ...agent } = value; return { id: action[role].agentId, expectedHash: expectedDocumentHash, value: agent };
};
const starterAgent = (action: ActionDefinition, role: ActionAgentRole): Omit<ActionAgentDefinition, "id" | "name"> => ({
  description: `${role === "validation" ? "Validation controller" : "Subordinate Work agent"} for ${action.name}.`,
  developerInstructions: role === "validation"
    ? `You are the read-only Validation controller for Action ${action.name} (${action.id}). Inspect its declared inputs, acceptance criteria, deliverables, selected Skills, and immutable evidence. Return only done, delegate, or blocked with exact evidence; never write files, approve decisions, route later Actions, or perform external writes.`
    : `You are the subordinate Work agent for Action ${action.name} (${action.id}). Execute only the bounded dynamic prompt delegated by Validation, use the Action's selected Skills, produce its declared deliverables in the managed worktree, and report exact checks and artifacts. Never approve decisions, route Actions, merge, push, deploy, or widen external-write authority.`,
  model: "gpt-5.6-sol", reasoningEffort: "high"
});
const publicSlot = (slot: ReturnType<CodexAgentRepository["requireAction"]>) => {
  const { source, ...value } = slot; void source; return value;
};
const requireState = (config: ProjectConfigurationV26, stateId: string): StateDefinition => {
  const state = config.environment.states.find(({ id }) => id === stateId); if (!state) throw new NotFoundError(`State ${stateId} was not found.`); return state;
};
const requireAction = (config: ProjectConfigurationV26, stateId: string, actionId: string): ActionDefinition => {
  const action = requireState(config, stateId).actions.find(({ id }) => id === actionId);
  if (!action) throw new NotFoundError(`Action ${actionId} was not found.`); return action;
};
const replaceState = (config: ProjectConfigurationV26, state: StateDefinition): ProjectConfigurationV26 => ({
  ...config, environment: { ...config.environment, states: replace(config.environment.states, state) }
});
const replace = <T extends { id: string }>(values: T[], value: T): T[] =>
  [...values.filter(({ id }) => id !== value.id), value].sort((left, right) => left.id.localeCompare(right.id));
