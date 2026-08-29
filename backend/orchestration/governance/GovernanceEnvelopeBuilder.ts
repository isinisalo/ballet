import type Database from "better-sqlite3";
import type { JsonValue } from "../../../shared/orchestration/primitives.js";
import type { RootSnapshotV14 } from "../../../shared/orchestration/runtime.js";
import type { CriticTaskEnvelope, RefinementTaskEnvelope } from "../../../shared/orchestration/taskEnvelopes.js";

export const buildCriticEnvelope = (input: {
  connection: Database.Database; criticRunId: string; taskId: string; snapshotSha256: string;
}): CriticTaskEnvelope => {
  const row = input.connection.prepare(`
    SELECT cr.critic_schedule_id, cr.run_evidence_id, ps.*, er.execution_snapshot_json
    FROM critic_runs cr JOIN run_evidences ps ON ps.run_evidence_id = cr.run_evidence_id
    JOIN environment_runs er ON er.environment_run_id = ps.environment_run_id
    WHERE cr.critic_run_id = ?
  `).get(input.criticRunId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Critic Run ${input.criticRunId} has no immutable Run Evidence.`);
  const snapshot = JSON.parse(String(row.execution_snapshot_json)) as RootSnapshotV14;
  const composition = snapshot.governance.critic;
  const instruction = requireInstruction(snapshot, composition.instructionResource);
  const feedback = input.connection.prepare(`
    SELECT feedback_entry_id, category, target_type, target_id, comment, evidence_refs_json
    FROM feedback_entries WHERE environment_run_id = ? AND status = 'open' ORDER BY created_at
  `).all(String(row.environment_run_id));
  return {
    version: 11, taskId: input.taskId, environmentRunId: String(row.environment_run_id),
    snapshotSha256: input.snapshotSha256, instruction,
    context: json({
      boundary: "proposal only; do not modify files and do not approve",
      direction: { approvedUseCases: snapshot.approvedUseCases, ...snapshot.direction },
      runEvidence: {
        id: row.run_evidence_id, resultCommit: row.result_commit,
        changedFiles: JSON.parse(String(row.changed_files_json)), artifacts: JSON.parse(String(row.artifact_refs_json)),
        validationSummary: JSON.parse(String(row.validation_summary_json))
      },
      openFeedback: feedback,
      requirements: { categories: ["system", "architecture", "code", "design", "documentation"], exactTargetRequired: true }
    }),
    role: "critic", phase: "proposal", criticRunId: input.criticRunId,
    scheduleId: String(row.critic_schedule_id), runEvidenceIds: [String(row.run_evidence_id)]
  };
};

export const buildRefinementEnvelope = (input: {
  connection: Database.Database; refinementRunId: string; taskId: string; snapshotSha256: string;
}): RefinementTaskEnvelope => {
  const row = input.connection.prepare(`
    SELECT rr.source_environment_run_id, er.execution_snapshot_json
    FROM refinement_runs rr JOIN environment_runs er ON er.environment_run_id = rr.source_environment_run_id
    WHERE rr.refinement_run_id = ?
  `).get(input.refinementRunId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Refinement Run ${input.refinementRunId} has no immutable source.`);
  const snapshot = JSON.parse(String(row.execution_snapshot_json)) as RootSnapshotV14;
  const selected = input.connection.prepare(`
    SELECT fe.* FROM refinement_run_feedback rrf
    JOIN feedback_entries fe ON fe.feedback_entry_id = rrf.feedback_entry_id
    WHERE rrf.refinement_run_id = ? ORDER BY fe.created_at
  `).all(input.refinementRunId);
  const composition = snapshot.governance.refinement;
  const resources = snapshot.resources;
  const preimageHashes = Object.fromEntries(resources.map(({ relativePath, sourceSha256 }) => [relativePath, sourceSha256]));
  return {
    version: 11, taskId: input.taskId, environmentRunId: String(row.source_environment_run_id),
    snapshotSha256: input.snapshotSha256, instruction: requireInstruction(snapshot, composition.instructionResource),
    context: json({
      boundary: "read-only proposal; no write and no approval",
      feedback: selected,
      direction: { approvedUseCases: snapshot.approvedUseCases, ...snapshot.direction },
      resources,
      actions: snapshot.environment.states.flatMap(({ actions }) => actions).map((action) => ({
        id: action.id, validationSkillIds: action.validation.skillResources, workSkillIds: action.work.skillResources
      })),
      allowedPathPolicy: ["immutable snapshot resource paths in the active composition namespace"]
    }),
    role: "refinement", phase: "proposal", refinementRunId: input.refinementRunId,
    approvedCriticProposalIds: selected.flatMap((item) => {
      const id = Reflect.get(item as object, "critic_proposal_id");
      return typeof id === "string" ? [id] : [];
    }),
    allowedPaths: Object.keys(preimageHashes).sort(), preimageHashes
  };
};

const requireInstruction = (snapshot: RootSnapshotV14, id: string): string => {
  const resource = snapshot.resources.find(({ kind, id: resourceId }) => kind === "instruction" && resourceId === id);
  if (!resource) throw new Error(`Governance instruction ${id} is absent from snapshot.`);
  return resource.content;
};
const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
