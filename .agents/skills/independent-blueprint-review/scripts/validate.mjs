#!/usr/bin/env node
import process from "node:process";
import {
  emitResult,
  issue,
  parseArgs,
  runValidator,
  validateCommonArtifact,
  readYaml,
  validateExternalActions,
  verifyFileReference
} from "../../_shared/scripts/validation-lib.mjs";

const validator = "independent-blueprint-review";

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.review) throw new Error("--review is required.");
  const reviewResult = validateCommonArtifact(root, args.review, "blueprint_review");
  const issues = [...reviewResult.issues];
  const review = reviewResult.document ?? {};
  if (review.verdict !== "approved") {
    issue(issues, ["changes_requested", "blocked"].includes(review.verdict), "invalid_review_verdict", "Review verdict must be approved, changes_requested, or blocked.");
    issue(issues, !args.packet, "stale_gate_packet", "A non-approved review must not have a gate packet.", args.packet);
    issue(issues, Array.isArray(review.findings) && review.findings.length > 0, "missing_nonapproval_findings", "A non-approved review must persist findings.");
    emitResult(validator, issues.length === 0 ? (review.verdict === "changes_requested" ? "changes-requested" : "blocked") : "blocked", issues, {
      verdict: review.verdict,
      packetPresent: Boolean(args.packet)
    });
    return;
  }
  if (!args.packet) throw new Error("An approved review requires --packet.");
  const packetResult = validateCommonArtifact(root, args.packet, "blueprint_gate_packet");
  issues.push(...packetResult.issues);
  const packet = packetResult.document ?? {};
  issue(issues, review.verdict === "approved", "review_not_approved", "Blueprint review verdict must be approved.");
  issue(issues, Array.isArray(review.findings) && review.findings.length === 0, "blocking_review_findings", "Approved review must have no findings.");
  issue(issues, Array.isArray(review.checks) && review.checks.length > 0 && review.checks.every((check) => check?.status === "passed"), "review_checks_not_passed", "Every review check must pass.");
  issue(issues, packet.verdict === "approved", "packet_not_approved", "Gate packet verdict must be approved.");
  issue(issues, packet.source_sha === review.source_sha, "review_packet_source_sha_mismatch", "Review and packet source_sha must match.");
  issue(issues, packet.verifier?.id === review.verifier?.id, "verifier_identity_mismatch", "Review and packet verifier IDs must match.");
  const authors = new Set((packet.artifacts ?? []).map((artifact) => artifact?.author).filter(Boolean));
  issue(issues, typeof packet.verifier?.id === "string" && !authors.has(packet.verifier.id), "reviewer_not_independent", "Verifier must differ from every artifact author.");
  issue(issues, Array.isArray(packet.artifacts) && packet.artifacts.length > 0, "missing_packet_artifacts", "Packet artifacts must be nonempty.");
  for (const [index, artifact] of (packet.artifacts ?? []).entries()) {
    verifyFileReference(root, artifact, issues, `artifacts.${index}`);
    if (typeof artifact?.path === "string") {
      try {
        const persisted = readYaml(root, artifact.path).document;
        issue(issues, persisted?.author?.agent_id === artifact.author, "packet_artifact_author_mismatch", "Packet artifact author must match persisted author.agent_id.", artifact.path);
        issue(issues, persisted?.source_sha === packet.source_sha, "packet_artifact_source_sha_mismatch", "Packet artifact source_sha must match packet source_sha.", artifact.path);
      } catch (error) {
        issues.push({ code: "packet_artifact_unreadable", message: error instanceof Error ? error.message : String(error), path: artifact.path });
      }
    }
  }
  verifyFileReference(root, packet.review, issues, "review");
  issue(issues, Array.isArray(packet.open_decisions) && packet.open_decisions.length === 0, "open_packet_decisions", "Approved packet must have no open decisions.");
  issue(issues, Array.isArray(packet.new_assumptions) && packet.new_assumptions.length === 0, "new_packet_assumptions", "Approved packet must have no new assumptions.");
  issue(issues, packet.coverage?.source_to_test === 1, "packet_coverage_incomplete", "Packet source_to_test coverage must equal 1.");
  validateExternalActions(packet.external_actions, issues);
  for (const [index, action] of (packet.external_actions ?? []).entries()) {
    issue(issues, action?.status === "not_executed", "packet_action_not_unexecuted", "Approved blueprint packet external actions must remain not_executed.", `external_actions.${index}.status`);
  }
  emitResult(validator, issues.length === 0 ? "approved" : "blocked", issues, {
    artifactCount: packet.artifacts?.length ?? 0,
    verifier: packet.verifier?.id,
    sourceSha: packet.source_sha
  });
});
