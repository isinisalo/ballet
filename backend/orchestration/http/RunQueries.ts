import type Database from "better-sqlite3";
import { actionFlags } from "../../../shared/orchestration/gates.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { ControlFlowStore } from "../persistence/ControlFlowStore.js";
import { RunEvidenceStore } from "../persistence/RunEvidenceStore.js";

export class RunQueries {
  private readonly runs: EnvironmentRunStore;
  private readonly events: ControlFlowStore;
  private readonly runEvidences: RunEvidenceStore;
  constructor(private readonly connection: () => Database.Database) {
    this.runs = new EnvironmentRunStore(connection);
    this.events = new ControlFlowStore(connection);
    this.runEvidences = new RunEvidenceStore(connection);
  }
  run(id: string): unknown {
    const run = this.runs.require(id);
    const states = this.runs.states(id).map((state) => {
      const actions = this.runs.actions(state.stateExecutionId).map((action) => ({
        ...action, definitionSnapshot: undefined, ...actionFlags(action.status)
      }));
      return { ...state, definitionSnapshot: undefined, actions,
        done: actions.length > 0 && actions.every(({ status }) => status === "done"),
        blocked: actions.some(({ status }) => status === "blocked") };
    });
    const activeAgentRow = run.activeAgentRunId ? this.connection().prepare(`
      SELECT agent_run_id, role, phase, status, revision, attempt, parent_agent_run_id, outcome_json, created_at, updated_at
      FROM agent_runs WHERE agent_run_id = ?
    `).get(run.activeAgentRunId) : undefined;
    const activeAgent = activeAgentRow ? { ...(activeAgentRow as Record<string, unknown>),
      outcome: Reflect.get(activeAgentRow as object, "outcome_json")
        ? JSON.parse(String(Reflect.get(activeAgentRow as object, "outcome_json"))) : undefined,
      outcome_json: undefined } : undefined;
    const evidence = run.status === "completed" ? this.runEvidences.requireByRun(id) : undefined;
    return { ...publicRun(run), activeAgent, states, events: this.eventFacts(id, 0), evidence };
  }
  listRuns(): unknown[] {
    const rows = this.connection().prepare(
      "SELECT environment_run_id FROM environment_runs ORDER BY created_at DESC LIMIT 200"
    ).all() as Array<{ environment_run_id: string }>;
    return rows.map(({ environment_run_id }) => publicRun(this.runs.require(environment_run_id)));
  }
  evidence(id: string): unknown { this.runs.require(id); return this.runEvidences.requireByRun(id); }
  eventFacts(id: string, after: number): unknown[] {
    this.runs.require(id);
    return this.events.list(id).filter((row) => Number(row.sequence) > after).slice(0, 500).map((row) => ({
      sequence: row.sequence, kind: row.kind, stateExecutionId: row.state_execution_id,
      actionExecutionId: row.action_execution_id, createdAt: row.created_at
    }));
  }

}

export const publicRun = (run: ReturnType<EnvironmentRunStore["require"]>) => ({
  environmentRunId: run.environmentRunId, environmentDefinitionId: run.environmentDefinitionId,
  source: run.source, previousRunId: run.previousRunId, input: run.input, status: run.status, revision: run.revision,
  baseCommit: run.baseCommit, resultCommit: run.resultCommit, branch: run.branch,
  transitionCount: run.transitionCount, transitionLimit: run.transitionLimit,
  createdAt: run.createdAt, updatedAt: run.updatedAt, completedAt: run.completedAt
});
