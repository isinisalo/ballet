import type Database from "better-sqlite3";
import type {
  CreateEnvironmentRunInput, ProductSnapshotSeed, StoredActionExecution,
  StoredEnvironmentRun, StoredStateExecution
} from "../../../shared/orchestration/index.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { EnvironmentRunStore } from "./EnvironmentRunStore.js";
import { ProductSnapshotStore } from "./ProductSnapshotStore.js";
import { ConflictError, StaleStateError } from "./PersistenceErrors.js";
import { AgentExecutionStore } from "./AgentExecutionStore.js";

export class FlowCoordinator {
  constructor(
    private readonly connection: () => Database.Database,
    readonly runs = new EnvironmentRunStore(connection),
    private readonly execution = new AgentExecutionStore(connection),
    private readonly snapshots = new ProductSnapshotStore(connection),
    private readonly events = new ControlFlowStore(connection)
  ) {}

  createEnvironmentRun(input: CreateEnvironmentRunInput): StoredEnvironmentRun {
    return this.runs.create(input);
  }

  advance(environmentRunId: string, expectedRevision: number, at: string): StoredActionExecution {
    return this.connection().transaction(() => {
      const run = this.requireRunRevision(environmentRunId, expectedRevision);
      if (!["pending", "running"].includes(run.status) || run.activeActionExecutionId) {
        throw new ConflictError(`Environment Run ${environmentRunId} cannot advance from ${run.status}.`);
      }
      const state = this.firstOpenState(environmentRunId);
      if (state.status === "blocked" || state.status === "cancelled" || state.status === "interrupted") {
        throw new ConflictError(`State ${state.stateExecutionId} gates later work.`);
      }
      const activated = state.status === "pending";
      if (activated) this.activateState(state, at);
      const action = this.firstOpenAction(state.stateExecutionId);
      if (action.status !== "pending") throw new ConflictError(`Action ${action.actionExecutionId} is already active or terminal.`);
      const selected = this.connection().prepare(`
        UPDATE action_executions SET status = 'prechecking', revision = revision + 1, updated_at = ?
        WHERE action_execution_id = ? AND revision = ? AND status = 'pending'
      `).run(at, action.actionExecutionId, action.revision);
      if (selected.changes !== 1) throw new StaleStateError(`Action ${action.actionExecutionId} changed during selection.`);
      const advanced = this.connection().prepare(`
        UPDATE environment_runs SET status = 'running', active_state_execution_id = ?,
          active_action_execution_id = ?, revision = revision + 1, updated_at = ?
        WHERE environment_run_id = ? AND revision = ? AND active_action_execution_id IS NULL
      `).run(state.stateExecutionId, action.actionExecutionId, at, environmentRunId, expectedRevision);
      if (advanced.changes !== 1) throw new StaleStateError(`Environment Run ${environmentRunId} changed during advance.`);
      if (activated) this.events.append(environmentRunId, "state_activated", { stateExecutionId: state.stateExecutionId }, at);
      this.events.append(environmentRunId, "action_selected", {
        stateExecutionId: state.stateExecutionId, actionExecutionId: action.actionExecutionId
      }, at);
      return this.runs.requireAction(action.actionExecutionId);
    })();
  }

  completeState(stateExecutionId: string, expectedRevision: number, at: string): StoredStateExecution {
    return this.connection().transaction(() => {
      const state = this.runs.requireState(stateExecutionId);
      if (state.revision !== expectedRevision) throw new StaleStateError(`State ${stateExecutionId} revision is stale.`);
      if (state.status !== "running") throw new ConflictError(`State ${stateExecutionId} is not running.`);
      const actions = this.runs.actions(stateExecutionId);
      if (actions.length === 0 || actions.some(({ status }) => status !== "done")) {
        throw new ConflictError(`State ${stateExecutionId} cannot complete before every Action is done.`);
      }
      const updated = this.connection().prepare(`
        UPDATE state_executions SET status = 'done', revision = revision + 1, completed_at = ?, updated_at = ?
        WHERE state_execution_id = ? AND revision = ? AND status = 'running'
      `).run(at, at, stateExecutionId, expectedRevision);
      if (updated.changes !== 1) throw new StaleStateError(`State ${stateExecutionId} changed during completion.`);
      this.connection().prepare(`
        UPDATE environment_runs SET active_state_execution_id = NULL, active_action_execution_id = NULL,
          active_agent_run_id = NULL, revision = revision + 1, updated_at = ?
        WHERE environment_run_id = ? AND status = 'running'
      `).run(at, state.environmentRunId);
      this.events.append(state.environmentRunId, "state_completed", { stateExecutionId }, at);
      return this.runs.requireState(stateExecutionId);
    })();
  }

  completeEnvironment(input: ProductSnapshotSeed, expectedRevision: number): StoredEnvironmentRun {
    return this.connection().transaction(() => {
      const run = this.requireRunRevision(input.environmentRunId, expectedRevision);
      if (run.status !== "running" || run.activeStateExecutionId || run.activeActionExecutionId || run.activeAgentRunId) {
        throw new ConflictError(`Environment Run ${run.environmentRunId} is not ready for completion.`);
      }
      const states = this.runs.states(run.environmentRunId);
      if (states.length === 0 || states.some(({ status }) => status !== "done")) {
        throw new ConflictError("Environment cannot complete before every State is done.");
      }
      const updated = this.connection().prepare(`
        UPDATE environment_runs SET status = 'completed', result_commit = ?, revision = revision + 1,
          finalization_status = 'completed', completed_at = ?, updated_at = ?
        WHERE environment_run_id = ? AND revision = ? AND status = 'running'
      `).run(input.resultCommit, input.createdAt, input.createdAt, input.environmentRunId, expectedRevision);
      if (updated.changes !== 1) throw new StaleStateError(`Environment Run ${run.environmentRunId} changed during completion.`);
      this.snapshots.create(input);
      this.events.append(run.environmentRunId, "environment_completed", {}, input.createdAt);
      return this.runs.require(run.environmentRunId);
    })();
  }

  stop(environmentRunId: string, expectedRevision: number, kind: "cancelled" | "interrupted", at: string): StoredEnvironmentRun {
    return this.connection().transaction(() => {
      const run = this.requireRunRevision(environmentRunId, expectedRevision);
      if (!["pending", "running"].includes(run.status)) throw new ConflictError(`Environment Run ${environmentRunId} is terminal.`);
      if (run.activeAgentRunId) this.execution.cancelAgent(run.activeAgentRunId, kind, at);
      if (run.activeActionExecutionId) this.connection().prepare(`
        UPDATE action_executions SET status = ?, active_agent_run_id = NULL, revision = revision + 1,
          completed_at = ?, updated_at = ? WHERE action_execution_id = ?
      `).run(kind, at, at, run.activeActionExecutionId);
      if (run.activeStateExecutionId) this.connection().prepare(`
        UPDATE state_executions SET status = ?, revision = revision + 1, completed_at = ?, updated_at = ?
        WHERE state_execution_id = ?
      `).run(kind, at, at, run.activeStateExecutionId);
      this.connection().prepare(`
        UPDATE environment_runs SET status = ?, active_state_execution_id = NULL,
          active_action_execution_id = NULL, active_agent_run_id = NULL, revision = revision + 1,
          completed_at = ?, updated_at = ? WHERE environment_run_id = ? AND revision = ?
      `).run(kind, at, at, environmentRunId, expectedRevision);
      this.events.append(environmentRunId, kind === "cancelled" ? "environment_cancelled" : "execution_interrupted", {}, at);
      return this.runs.require(environmentRunId);
    })();
  }

  private requireRunRevision(environmentRunId: string, expectedRevision: number): StoredEnvironmentRun {
    const run = this.runs.require(environmentRunId);
    if (run.revision !== expectedRevision) throw new StaleStateError(`Environment Run ${environmentRunId} revision is stale.`);
    return run;
  }

  private firstOpenState(environmentRunId: string): StoredStateExecution {
    const state = this.runs.states(environmentRunId).find(({ status }) => status !== "done");
    if (!state) throw new ConflictError(`Environment Run ${environmentRunId} has no unfinished State.`);
    return state;
  }

  private firstOpenAction(stateExecutionId: string): StoredActionExecution {
    const action = this.runs.actions(stateExecutionId).find(({ status }) => status !== "done");
    if (!action) throw new ConflictError(`State ${stateExecutionId} has no unfinished Action.`);
    return action;
  }

  private activateState(state: StoredStateExecution, at: string): void {
    const updated = this.connection().prepare(`
      UPDATE state_executions SET status = 'running', revision = revision + 1, updated_at = ?
      WHERE state_execution_id = ? AND revision = ? AND status = 'pending'
    `).run(at, state.stateExecutionId, state.revision);
    if (updated.changes !== 1) throw new StaleStateError(`State ${state.stateExecutionId} changed during activation.`);
  }
}
