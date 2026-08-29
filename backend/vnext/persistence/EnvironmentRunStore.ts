import type Database from "better-sqlite3";
import type {
  CreateEnvironmentRunInput, JsonValue, StoredActionExecution, StoredEnvironmentRun, StoredStateExecution
} from "../../../shared/vnext/index.js";
import { canonicalJson, sha256 } from "../../../shared/vnext/primitives.js";
import { actionDefinitionSchema, stateDefinitionSchema } from "../../../shared/vnext/schemas/environmentSchemas.js";
import { rootSnapshotV13Schema } from "../../../shared/vnext/schemas/runtimeSchemas.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { toActionExecution, toEnvironmentRun, toStateExecution } from "./RowMappers.js";
import { VNextConflictError, VNextNotFoundError } from "./VNextErrors.js";

export class EnvironmentRunStore {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly events = new ControlFlowStore(connection)
  ) {}

  create(input: CreateEnvironmentRunInput): StoredEnvironmentRun {
    const snapshot = rootSnapshotV13Schema.parse(input.executionSnapshot);
    assertHash(snapshot, input.executionSnapshotHash, "execution snapshot");
    if (input.states.length === 0) throw new VNextConflictError("Environment Run requires at least one State.");
    return this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO environment_runs (
          environment_run_id, environment_definition_id, source, previous_run_id, status,
          base_commit, worktree_path, branch, execution_snapshot_json, execution_snapshot_hash,
          transition_limit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.environmentRunId, input.environmentDefinitionId, input.source, input.previousRunId ?? null,
        input.baseCommit, input.worktreePath, input.branch, canonical(snapshot), input.executionSnapshotHash,
        input.transitionLimit, input.createdAt, input.createdAt);
      this.insertStates(input);
      this.events.append(input.environmentRunId, "environment_started", {}, input.createdAt);
      for (const state of input.states) for (const action of state.actions) {
        if (action.importedDoneEvidence !== undefined) this.events.append(input.environmentRunId, "action_imported", {
          stateExecutionId: state.stateExecutionId, actionExecutionId: action.actionExecutionId,
          data: {
            originatingRunId: action.originatingRunId ?? null,
            priorActionExecutionId: action.priorActionExecutionId ?? null
          }
        }, input.createdAt);
      }
      return this.require(input.environmentRunId);
    })();
  }

  get(environmentRunId: string): StoredEnvironmentRun | undefined {
    const row = this.connection().prepare("SELECT * FROM environment_runs WHERE environment_run_id = ?")
      .get(environmentRunId);
    return row ? toEnvironmentRun(row) : undefined;
  }

  require(environmentRunId: string): StoredEnvironmentRun {
    const run = this.get(environmentRunId);
    if (!run) throw new VNextNotFoundError(`Environment Run ${environmentRunId} was not found.`);
    return run;
  }

  states(environmentRunId: string): StoredStateExecution[] {
    return this.connection().prepare(`
      SELECT * FROM state_executions WHERE environment_run_id = ? ORDER BY state_order
    `).all(environmentRunId).map(toStateExecution);
  }

  actions(stateExecutionId: string): StoredActionExecution[] {
    return this.connection().prepare(`
      SELECT * FROM action_executions WHERE state_execution_id = ? ORDER BY action_priority
    `).all(stateExecutionId).map(toActionExecution);
  }

  requireState(stateExecutionId: string): StoredStateExecution {
    const row = this.connection().prepare("SELECT * FROM state_executions WHERE state_execution_id = ?").get(stateExecutionId);
    if (!row) throw new VNextNotFoundError(`State Execution ${stateExecutionId} was not found.`);
    return toStateExecution(row);
  }

  requireAction(actionExecutionId: string): StoredActionExecution {
    const row = this.connection().prepare("SELECT * FROM action_executions WHERE action_execution_id = ?").get(actionExecutionId);
    if (!row) throw new VNextNotFoundError(`Action Execution ${actionExecutionId} was not found.`);
    return toActionExecution(row);
  }

  private insertStates(input: CreateEnvironmentRunInput): void {
    const seenOrders = new Set<number>();
    for (const stateSeed of [...input.states].sort((left, right) => left.definition.order - right.definition.order)) {
      const definition = stateDefinitionSchema.parse(stateSeed.definition);
      if (seenOrders.has(definition.order)) throw new VNextConflictError(`Duplicate State order ${definition.order}.`);
      seenOrders.add(definition.order);
      assertHash(definition, stateSeed.definitionHash, `State ${definition.id}`);
      if (stateSeed.actions.length === 0) throw new VNextConflictError(`State ${definition.id} requires an Action.`);
      const seededActionIds = new Set(stateSeed.actions.map(({ definition: action }) => action.id));
      if (definition.actions.length !== seededActionIds.size
        || definition.actions.some(({ id }) => !seededActionIds.has(id))) {
        throw new VNextConflictError(`State ${definition.id} Action seeds differ from its immutable definition.`);
      }
      const allImported = stateSeed.actions.every(({ importedDoneEvidence }) => importedDoneEvidence !== undefined);
      this.connection().prepare(`
        INSERT INTO state_executions (
          state_execution_id, environment_run_id, state_definition_id, state_order,
          definition_snapshot_json, definition_snapshot_hash, status, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(stateSeed.stateExecutionId, input.environmentRunId, definition.id, definition.order,
        canonical(definition), stateSeed.definitionHash, allImported ? "done" : "pending",
        input.createdAt, input.createdAt, allImported ? input.createdAt : null);
      this.insertActions(input, stateSeed.stateExecutionId, stateSeed.actions);
    }
  }

  private insertActions(
    input: CreateEnvironmentRunInput,
    stateExecutionId: string,
    actions: CreateEnvironmentRunInput["states"][number]["actions"]
  ): void {
    const seenPriorities = new Set<number>();
    for (const seed of [...actions].sort((left, right) => left.definition.priority - right.definition.priority)) {
      const definition = actionDefinitionSchema.parse(seed.definition);
      if (seenPriorities.has(definition.priority)) throw new VNextConflictError(`Duplicate Action priority ${definition.priority}.`);
      seenPriorities.add(definition.priority);
      assertHash(definition, seed.definitionHash, `Action ${definition.id}`);
      const imported = seed.importedDoneEvidence !== undefined;
      this.connection().prepare(`
        INSERT INTO action_executions (
          action_execution_id, state_execution_id, environment_run_id, action_definition_id,
          action_priority, definition_snapshot_json, definition_snapshot_hash, status, max_retries,
          originating_run_id, prior_action_execution_id, imported_done_evidence_json,
          created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(seed.actionExecutionId, stateExecutionId, input.environmentRunId, definition.id,
        definition.priority, canonical(definition), seed.definitionHash, imported ? "done" : "pending",
        definition.maxRetries, seed.originatingRunId ?? null, seed.priorActionExecutionId ?? null,
        imported ? canonical(seed.importedDoneEvidence as JsonValue) : null,
        input.createdAt, input.createdAt, imported ? input.createdAt : null);
    }
  }
}

const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);

const assertHash = (value: unknown, expected: string, label: string): void => {
  if (sha256(canonical(value)) !== expected) throw new VNextConflictError(`${label} hash does not match immutable content.`);
};
