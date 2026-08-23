import type Database from "better-sqlite3";
import { policyDecisionRecordSchema, policyOptionObservationSchema } from "../../shared/api/runtime-schemas.js";
import type {
  AcceptanceLedgerSnapshotV1,
  PolicyDecisionRecordV3,
  PolicyOptionObservationV4
} from "../../shared/domain/decisionModel.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import type { RootRunOrchestrationProjection } from "../../shared/domain/runs.js";
import { canonicalJson, jsonSha256 } from "./state/CanonicalJson.js";

type Row = Record<string, unknown>;

export class RuntimePolicyStore {
  constructor(private readonly connection: () => Database.Database) {}

  initializeLedger(rootRunId: string, snapshot: AcceptanceLedgerSnapshotV1): void {
    const insert = this.connection().prepare(`
      INSERT INTO acceptance_ledger_entries (
        root_run_id, obligation_id, weight, status, evidence_refs_json, updated_by_validation_node_run_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const entry of snapshot.entries) insert.run(
      rootRunId, entry.obligationId, entry.weight, entry.status, canonicalJson(entry.evidenceRefs),
      entry.updatedByValidationNodeRunId ?? null
    );
  }

  ledger(rootRunId: string): AcceptanceLedgerSnapshotV1 {
    const entries = (this.connection().prepare(`
      SELECT * FROM acceptance_ledger_entries WHERE root_run_id = ? ORDER BY obligation_id
    `).all(rootRunId) as Row[]).map((row) => ({
      obligationId: String(row.obligation_id),
      weight: Number(row.weight),
      status: String(row.status) as "pending" | "verified" | "invalidated",
      evidenceRefs: JSON.parse(String(row.evidence_refs_json)) as string[],
      updatedByValidationNodeRunId: optional(row.updated_by_validation_node_run_id)
    }));
    return { version: 1, entries, sha256: jsonSha256(entries as unknown as import("../../shared/domain/automation.js").JsonValue) };
  }

  applyAcceptance(rootRunId: string, validationNodeRunId: string, change: {
    verifyObligationIds: string[];
    invalidateObligationIds: string[];
    evidenceRefs: string[];
  }): AcceptanceLedgerSnapshotV1 {
    const current = this.ledger(rootRunId);
    const known = new Set(current.entries.map(({ obligationId }) => obligationId));
    const requested = [...change.verifyObligationIds, ...change.invalidateObligationIds];
    if (requested.some((id) => !known.has(id))) throw new Error("Validation referenced an obligation outside the immutable ledger.");
    if (new Set(requested).size !== requested.length) throw new Error("Validation classified an obligation more than once.");
    const update = this.connection().prepare(`
      UPDATE acceptance_ledger_entries SET status = ?, evidence_refs_json = ?, updated_by_validation_node_run_id = ?
      WHERE root_run_id = ? AND obligation_id = ?
    `);
    for (const entry of current.entries) {
      const status = change.verifyObligationIds.includes(entry.obligationId) ? "verified"
        : change.invalidateObligationIds.includes(entry.obligationId) ? "invalidated" : entry.status;
      if (status === entry.status) continue;
      update.run(status, canonicalJson([...new Set([...entry.evidenceRefs, ...change.evidenceRefs])].sort()),
        validationNodeRunId, rootRunId, entry.obligationId);
    }
    return this.ledger(rootRunId);
  }

  insertDecision(record: PolicyDecisionRecordV3): void {
    const parsed = policyDecisionRecordSchema.parse(record);
    this.connection().prepare(`
      INSERT INTO policy_decisions (policy_decision_id, root_run_id, epoch, record_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(parsed.policyDecisionId, parsed.rootRunId, parsed.epoch, canonicalJson(jsonValue(parsed)), parsed.createdAt);
  }

  latestDecision(rootRunId: string): PolicyDecisionRecordV3 | undefined {
    const row = this.connection().prepare(`
      SELECT record_json FROM policy_decisions WHERE root_run_id = ? ORDER BY epoch DESC LIMIT 1
    `).get(rootRunId) as Row | undefined;
    return row ? policyDecisionRecordSchema.parse(JSON.parse(String(row.record_json))) as PolicyDecisionRecordV3 : undefined;
  }

  insertObservation(observation: PolicyOptionObservationV4): void {
    const parsed = policyOptionObservationSchema.parse(observation);
    this.connection().prepare(`
      INSERT INTO policy_observations (
        policy_observation_id, root_run_id, policy_decision_id, action_invocation_id, record_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(parsed.policyObservationId, parsed.rootRunId, parsed.policyDecisionId, parsed.actionInvocationId,
      canonicalJson(jsonValue(parsed)), parsed.createdAt);
  }

  read(rootRunId: string, snapshot: RootExecutionSnapshot): RootRunOrchestrationProjection {
    const decisions = (this.connection().prepare(`
      SELECT record_json FROM policy_decisions WHERE root_run_id = ? ORDER BY epoch
    `).all(rootRunId) as Row[]).map((row) =>
      policyDecisionRecordSchema.parse(JSON.parse(String(row.record_json))) as PolicyDecisionRecordV3);
    const observations = (this.connection().prepare(`
      SELECT record_json FROM policy_observations WHERE root_run_id = ? ORDER BY created_at
    `).all(rootRunId) as Row[]).map((row) =>
      policyOptionObservationSchema.parse(JSON.parse(String(row.record_json))) as PolicyOptionObservationV4);
    return {
      policyDecisions: decisions,
      policyObservations: observations,
      compiledPolicy: snapshot.compiledPolicy,
      acceptanceLedger: this.ledger(rootRunId)
    };
  }
}

const optional = (value: unknown): string | undefined => value === null || value === undefined ? undefined : String(value);
const jsonValue = (value: unknown): import("../../shared/domain/automation.js").JsonValue =>
  JSON.parse(JSON.stringify(value)) as import("../../shared/domain/automation.js").JsonValue;
