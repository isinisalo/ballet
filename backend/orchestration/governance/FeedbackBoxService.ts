import type Database from "better-sqlite3";
import type {
  FeedbackCategory, FeedbackTargetType, TrustedHumanActor
} from "../../../shared/orchestration/index.js";
import { FeedbackStore } from "../persistence/FeedbackStore.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export interface HumanFeedbackCommand {
  feedbackEntryId: string;
  category: FeedbackCategory;
  comment: string;
  sourceCommit: string;
  createdAt: string;
}

export class FeedbackBoxService {
  private readonly store: FeedbackStore;
  constructor(private readonly connection: () => Database.Database) {
    this.store = new FeedbackStore(connection);
  }

  createHuman(command: HumanFeedbackCommand, actor: TrustedHumanActor): void {
    if (!actor.id.trim()) throw new ConflictError("Trusted human identity is required.");
    const owner = this.connection().prepare(`
      SELECT environment_run_id FROM environment_runs ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get() as { environment_run_id: string } | undefined;
    this.store.create({
      feedbackEntryId: command.feedbackEntryId, category: command.category, comment: command.comment,
      source: "human",
      targetType: owner ? "environment_run" : "environment_definition",
      targetId: owner?.environment_run_id ?? "project",
      environmentRunId: owner?.environment_run_id,
      createdBy: actor.id,
      provenance: { actor: { id: actor.id, source: actor.source }, sourceCommit: command.sourceCommit },
      createdAt: command.createdAt
    });
  }

  list(input: { environmentRunId?: string; status?: string; category?: FeedbackCategory }): Array<Record<string, unknown>> {
    const rows = this.store.list(input.environmentRunId);
    return rows.filter((row) => (!input.status || row.status === input.status) && (!input.category || row.category === input.category));
  }

  transitionHuman(
    feedbackEntryId: string,
    from: "open" | "in_refinement",
    to: "resolved" | "dismissed",
    at: string,
    actor: TrustedHumanActor
  ): void {
    this.store.transition({ feedbackEntryId, from, to, actorId: actor.id, at });
  }
}

export const validateFeedbackTarget = (
  connection: Database.Database,
  environmentRunId: string,
  type: FeedbackTargetType,
  id: string
): void => {
  const run = connection.prepare("SELECT execution_snapshot_json FROM environment_runs WHERE environment_run_id = ?")
    .get(environmentRunId) as { execution_snapshot_json: string } | undefined;
  if (!run) throw new ConflictError(`Feedback Environment Run ${environmentRunId} does not exist.`);
  const snapshot = JSON.parse(run.execution_snapshot_json) as Record<string, unknown>;
  const exists = type === "environment_run" ? id === environmentRunId
    : type === "run_evidence" ? hasOwnedRunEvidence(connection, id, environmentRunId)
      : type === "state_execution" ? hasOwnedRow(connection, "state_executions", "state_execution_id", id, environmentRunId)
        : type === "action_execution" ? hasOwnedRow(connection, "action_executions", "action_execution_id", id, environmentRunId)
          : type === "environment_definition" ? Reflect.get(snapshot.environment as object, "id") === id
            : type === "state_definition" ? definitions(snapshot, "states").some((state) => state.id === id)
              : type === "action_definition" ? definitions(snapshot, "actions").some((action) => action.id === id)
                : isSafeResourceTarget(snapshot, id);
  if (!exists) throw new ConflictError(`Feedback target ${type}:${id} does not exist in its immutable closure.`);
};

const hasOwnedRunEvidence = (db: Database.Database, id: string, runId: string): boolean =>
  Boolean(db.prepare("SELECT 1 FROM run_evidences WHERE run_evidence_id = ? AND environment_run_id = ?").get(id, runId));
const hasOwnedRow = (db: Database.Database, table: string, key: string, id: string, runId: string): boolean => {
  const allowed = new Set(["state_executions:state_execution_id", "action_executions:action_execution_id"]);
  if (!allowed.has(`${table}:${key}`)) throw new Error("Unsafe target selector.");
  return Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ? AND environment_run_id = ?`).get(id, runId));
};
const definitions = (snapshot: Record<string, unknown>, kind: "states" | "actions"): Array<{ id: string }> => {
  const environment = snapshot.environment as { states?: Array<{ id: string; actions?: Array<{ id: string }> }> } | undefined;
  const states = environment?.states ?? [];
  return kind === "states" ? states : states.flatMap(({ actions }) => actions ?? []);
};
const isSafeResourceTarget = (snapshot: Record<string, unknown>, relativePath: string): boolean => {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")
    || relativePath.split("/").some((part) => !part || part === "." || part === "..")
    || relativePath === ".git" || relativePath.startsWith(".git/")) return false;
  const resources = snapshot.resources as Array<{ relativePath?: string }> | undefined;
  return (resources ?? []).some((resource) => resource.relativePath === relativePath);
};
