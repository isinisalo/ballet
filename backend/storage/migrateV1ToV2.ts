import type Database from "better-sqlite3";

type LegacyAgentOutcome = "ready" | "approved" | "changes-requested" | "needs_input" | "blocked" | "failed";

interface LegacyStepRouteRow {
  step_run_id: string;
  step_id: string;
  step_type: "agent" | "human";
  result: string | null;
  outcome_json: string | null;
  error: string | null;
}

interface LegacyPersistedOutcome {
  outcome: LegacyAgentOutcome;
  failure?: { classification?: "transient" | "permanent"; code?: unknown };
  [key: string]: unknown;
}

export const migrateV1ToV2 = (database: Database.Database): void => {
  addColumn(database, "root_runs", "termination_json", "TEXT");
  addColumn(database, "loop_runs", "termination_json", "TEXT");
  addColumn(database, "step_runs", "transition_json", "TEXT");
  addColumn(database, "step_runs", "retry_of_step_run_id", "TEXT REFERENCES step_runs(step_run_id)");
  database.prepare("UPDATE step_runs SET attempt = 1 WHERE attempt < 1").run();
  normalizeLegacyAgentOutcomes(database);
  stopUnsafeLegacyRoutes(database);
};

const addColumn = (database: Database.Database, table: string, column: string, definition: string): void => {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((candidate) => candidate.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

const normalizeLegacyAgentOutcomes = (database: Database.Database): void => {
  const rows = database.prepare(`
    SELECT step_run_id, result, error, outcome_json FROM step_runs WHERE step_type = 'agent'
  `).all() as Array<Pick<LegacyStepRouteRow, "step_run_id" | "result" | "error" | "outcome_json">>;
  const update = database.prepare("UPDATE step_runs SET result = ?, outcome_json = COALESCE(?, outcome_json) WHERE step_run_id = ?");
  rows.forEach((row) => {
    const outcome = legacyOutcomeStatus(row.outcome_json);
    if (outcome) {
      update.run(outcome, null, row.step_run_id);
      return;
    }
    if (row.result !== "rejected") return;
    update.run("failed", JSON.stringify({
      outcome: "failed",
      summary: row.error ?? "Legacy agent execution failed without a structured outcome.",
      checks: [],
      failure: { classification: "permanent", code: "execution_failed" }
    }), row.step_run_id);
  });
};

const stopUnsafeLegacyRoutes = (database: Database.Database): void => {
  const runs = database.prepare(`
    SELECT run_id FROM loop_runs WHERE status IN ('running', 'waiting_for_human')
  `).all() as Array<{ run_id: string }>;
  const timestamp = new Date().toISOString();
  for (const run of runs) {
    const history = database.prepare(`
      SELECT step_run_id, step_id, step_type, result, outcome_json, error
      FROM step_runs WHERE run_id = ? ORDER BY created_at ASC, rowid ASC
    `).all(run.run_id) as LegacyStepRouteRow[];
    const unsafe = lastUnsafeLegacySignal(history);
    if (!unsafe) continue;
    stopLegacyRun(database, run.run_id, unsafe, timestamp);
  }
};

const stopLegacyRun = (
  database: Database.Database,
  runId: string,
  unsafe: LegacyStepRouteRow,
  timestamp: string
): void => {
  const signal = legacySignal(unsafe);
  const agentOutcome = signal.kind === "agent" ? legacyAgentOutcome(unsafe, signal.outcome) : undefined;
  const status = signal.kind === "agent" && signal.outcome === "failed" ? "failed" : "blocked";
  const code = signal.kind === "human" ? "human_rejected"
    : signal.outcome === "failed" ? agentOutcome?.failure?.code === "execution_failed" ? "execution_failed" : "agent_failed"
      : signal.outcome === "blocked" ? "agent_blocked"
        : signal.outcome === "needs_input" ? "needs_input" : "changes_requested";
  const message = `Legacy in-flight ${signal.kind === "human" ? signal.decision : signal.outcome} routing was stopped during the outcome-aware runtime migration.`;
  const termination = { status, code, message, stepRunId: unsafe.step_run_id, stepId: unsafe.step_id, signal };
  const transition = { signal, action: "terminate", status, code };
  database.prepare(`
    UPDATE execution_tasks SET status = 'cancelled', cancel_requested_at = ?,
      completed_at = COALESCE(completed_at, ?), updated_at = ?
    WHERE status IN ('queued', 'running') AND task_id IN (
      SELECT execution_task_id FROM step_runs WHERE run_id = ? AND execution_task_id IS NOT NULL
    )
  `).run(timestamp, timestamp, timestamp, runId);
  database.prepare(`
    UPDATE step_runs SET status = 'cancelled', completed_at = COALESCE(completed_at, ?), updated_at = ?
    WHERE run_id = ? AND status IN ('queued', 'running', 'waiting_for_human')
  `).run(timestamp, timestamp, runId);
  const serializedOutcome = agentOutcome ? JSON.stringify(agentOutcome) : null;
  database.prepare(`
    UPDATE step_runs SET status = ?, result = ?, outcome_json = COALESCE(?, outcome_json), transition_json = ?,
      completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE step_run_id = ?
  `).run(
    signal.kind === "agent" && signal.outcome === "blocked" ? "blocked"
      : signal.kind === "agent" && signal.outcome === "failed" ? "failed" : "completed",
    signal.kind === "agent" ? signal.outcome : signal.decision,
    serializedOutcome, JSON.stringify(transition), timestamp, timestamp, unsafe.step_run_id
  );
  database.prepare(`
    UPDATE loop_runs SET status = ?, termination_json = ?, completed_at = ?, updated_at = ?
    WHERE run_id = ?
  `).run(status, JSON.stringify(termination), timestamp, timestamp, runId);
};

const lastUnsafeLegacySignal = (history: LegacyStepRouteRow[]): LegacyStepRouteRow | undefined => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (unsafeLegacySignal(history[index]!)) return history[index];
  }
  return undefined;
};

const unsafeLegacySignal = (row: LegacyStepRouteRow): boolean => {
  if (row.step_type === "human") return row.result === "rejected";
  const outcome = legacyAgentOutcomeStatus(row);
  return outcome !== undefined && outcome !== "ready" && outcome !== "approved";
};

const legacySignal = (row: LegacyStepRouteRow) => row.step_type === "human"
  ? { kind: "human" as const, decision: "rejected" as const }
  : { kind: "agent" as const, outcome: legacyAgentOutcomeStatus(row)! };

const legacyAgentOutcomeStatus = (row: LegacyStepRouteRow): LegacyAgentOutcome | undefined =>
  legacyOutcomeStatus(row.outcome_json) ?? (row.result === "rejected" ? "failed" : undefined);

const legacyAgentOutcome = (row: LegacyStepRouteRow, outcome: LegacyAgentOutcome): LegacyPersistedOutcome => {
  if (legacyOutcomeStatus(row.outcome_json) === outcome) return JSON.parse(row.outcome_json!) as LegacyPersistedOutcome;
  return {
    outcome,
    summary: row.error ?? "Legacy agent execution failed without a structured outcome.",
    checks: [],
    ...(outcome === "failed" ? { failure: { classification: "permanent", code: "execution_failed" } } : {})
  };
};

const legacyOutcomeStatus = (value: string | null): LegacyAgentOutcome | undefined => {
  if (!value) return undefined;
  try {
    const outcome = (JSON.parse(value) as { outcome?: unknown }).outcome;
    return ["ready", "approved", "changes-requested", "needs_input", "blocked", "failed"].includes(String(outcome))
      ? outcome as LegacyAgentOutcome
      : undefined;
  } catch {
    return undefined;
  }
};
