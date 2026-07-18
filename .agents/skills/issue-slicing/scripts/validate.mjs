#!/usr/bin/env node
import { readFileSync } from "node:fs";
import process from "node:process";
import { parse as parseYaml } from "yaml";
import {
  GIT_SHA_PATTERN,
  SHA256_PATTERN,
  emitResult,
  issue,
  parseArgs,
  resolveInside,
  runValidator,
  sha256File,
  stringArray,
  validateCommonArtifact,
  validateExternalActions,
  verifyFileReference
} from "../../_shared/scripts/validation-lib.mjs";

const validator = "issue-slicing";

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.handoff || !args.manifest || !args.issues) throw new Error("--handoff, --manifest and --issues are required.");
  const handoff = parseYaml(readFileSync(resolveInside(root, args.handoff), "utf8"));
  const manifestResult = validateCommonArtifact(root, args.manifest, "milestone_manifest");
  const draftResult = validateCommonArtifact(root, args.issues, "issue_drafts");
  const issues = [...manifestResult.issues, ...draftResult.issues];
  const handoffKeys = Object.keys(handoff ?? {}).sort();
  const expectedHandoffKeys = ["blueprint_gate_packet", "blueprint_gate_packet_sha256", "milestone_id", "source_sha"].sort();
  issue(issues, JSON.stringify(handoffKeys) === JSON.stringify(expectedHandoffKeys), "invalid_handoff_fields", "Handoff must contain exactly the four documented fields.");
  issue(issues, /^milestone-\d{3}$/.test(handoff?.milestone_id ?? ""), "invalid_handoff_milestone", "Handoff milestone_id must match milestone-NNN.");
  issue(issues, typeof handoff?.blueprint_gate_packet === "string", "missing_handoff_packet", "Handoff packet path is required.");
  issue(issues, handoff?.blueprint_gate_packet === ".ballet/outputs/blueprint-gate-packet.yaml", "noncanonical_handoff_packet", "Handoff packet must use the canonical blueprint gate packet path.");
  issue(issues, SHA256_PATTERN.test(handoff?.blueprint_gate_packet_sha256 ?? ""), "invalid_handoff_packet_sha", "Handoff packet SHA-256 is required.");
  issue(issues, GIT_SHA_PATTERN.test(handoff?.source_sha ?? ""), "invalid_handoff_source_sha", "Handoff source_sha must be a Git SHA.");
  if (typeof handoff?.blueprint_gate_packet === "string" && SHA256_PATTERN.test(handoff?.blueprint_gate_packet_sha256 ?? "")) {
    issue(issues, sha256File(root, handoff.blueprint_gate_packet) === handoff.blueprint_gate_packet_sha256, "stale_blueprint_approval_sha", "Handoff packet SHA-256 does not match persisted packet bytes.");
    const packet = parseYaml(readFileSync(resolveInside(root, handoff.blueprint_gate_packet), "utf8"));
    issue(issues, packet?.source_sha === handoff.source_sha, "stale_handoff_source_sha", "Handoff source_sha does not match packet source_sha.");
    issue(issues, packet?.verdict === "approved", "unapproved_blueprint_packet", "Blueprint packet must be approved.");
    for (const [index, artifact] of (packet?.artifacts ?? []).entries()) verifyFileReference(root, artifact, issues, `packet.artifacts.${index}`);
  }
  issue(issues, manifestResult.document?.milestone_id === handoff?.milestone_id, "manifest_milestone_mismatch", "Milestone manifest must match handoff milestone_id.");
  issue(issues, typeof manifestResult.document?.slice_ref === "string", "missing_manifest_slice", "Milestone slice_ref is required.");
  issue(issues, stringArray(manifestResult.document?.included_scope), "missing_included_scope", "included_scope must be nonempty.");
  issue(issues, Array.isArray(manifestResult.document?.deferred_scope), "invalid_deferred_scope", "deferred_scope must be an array.");
  issue(issues, stringArray(manifestResult.document?.acceptance_refs), "missing_manifest_acceptance_refs", "Milestone acceptance_refs must be nonempty.");
  const drafts = draftResult.document?.issues;
  issue(issues, Array.isArray(drafts) && drafts.length > 0, "missing_issue_drafts", "Issue drafts must be nonempty.");
  for (const [index, draft] of (drafts ?? []).entries()) {
    issue(issues, typeof draft?.id === "string", "missing_issue_draft_id", "Issue draft ID is required.", `issues.${index}.id`);
    issue(issues, draft?.write_status === "draft_only", "issue_write_not_draft_only", "Issue write_status must remain draft_only.", `issues.${index}.write_status`);
    issue(issues, draft?.external_target === null, "issue_external_target_set", "Fixture issue external_target must remain null before approval.", `issues.${index}.external_target`);
    issue(issues, stringArray(draft?.source_refs), "missing_issue_source_refs", "Issue source_refs must be nonempty.", `issues.${index}.source_refs`);
    issue(issues, stringArray(draft?.artifact_refs), "missing_issue_artifact_refs", "Issue artifact_refs must be nonempty.", `issues.${index}.artifact_refs`);
    issue(issues, stringArray(draft?.acceptance_refs), "missing_issue_acceptance_refs", "Issue acceptance_refs must be nonempty.", `issues.${index}.acceptance_refs`);
    issue(issues, Array.isArray(draft?.dependencies), "invalid_issue_dependencies", "Issue dependencies must be an array.", `issues.${index}.dependencies`);
    validateExternalActions(draft?.external_actions ?? [], issues, `issues.${index}.external_actions`);
  }
  const draftIds = new Set((drafts ?? []).map((draft) => draft?.id));
  for (const [index, draft] of (drafts ?? []).entries()) {
    for (const dependency of draft?.dependencies ?? []) issue(issues, draftIds.has(dependency), "unknown_issue_dependency", "Issue dependency must resolve.", `issues.${index}.dependencies`);
  }
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map((drafts ?? []).map((draft) => [draft?.id, draft]));
  const hasCycle = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const cycle = (byId.get(id)?.dependencies ?? []).some(hasCycle);
    visiting.delete(id);
    visited.add(id);
    return cycle;
  };
  issue(issues, ![...draftIds].some(hasCycle), "issue_dependency_cycle", "Issue dependency graph must be acyclic.");
  const coveredAcceptance = new Set((drafts ?? []).flatMap((draft) => draft?.acceptance_refs ?? []));
  for (const acceptanceRef of manifestResult.document?.acceptance_refs ?? []) issue(issues, coveredAcceptance.has(acceptanceRef), "uncovered_milestone_acceptance", "Every milestone acceptance ref must be covered by an issue draft.", acceptanceRef);
  emitResult(validator, issues.length === 0 ? "ready" : "blocked", issues, { milestoneId: handoff?.milestone_id, draftCount: drafts?.length ?? 0 });
});
