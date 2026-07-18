#!/usr/bin/env node
import { readFileSync } from "node:fs";
import process from "node:process";
import { parse as parseYaml } from "yaml";
import {
  GIT_SHA_PATTERN,
  emitResult,
  issue,
  parseArgs,
  resolveInside,
  runValidator,
  validateCommonArtifact,
  validateExternalActions,
  verifyFileReference
} from "./validation-lib.mjs";

const validator = "delivery-evidence";

const read = (root, candidate) => parseYaml(readFileSync(resolveInside(root, candidate), "utf8"));

const exactKeys = (value, expected, issues, code, label) => {
  const actual = Object.keys(value ?? {}).sort();
  issue(issues, JSON.stringify(actual) === JSON.stringify([...expected].sort()), code, `${label} must contain exactly the documented fields.`);
};

const validatePlanningApproval = (root, approvalPath, issues) => {
  const approval = read(root, approvalPath);
  exactKeys(approval, ["approval_contract_version", "kind", "decision", "approved_by", "subject", "external_actions"], issues, "invalid_planning_approval_fields", "Milestone approval");
  issue(issues, approval?.approval_contract_version === 1, "invalid_approval_contract", "approval_contract_version must equal 1.");
  issue(issues, approval?.kind === "milestone_gate_claim", "invalid_approval_kind", "Expected milestone_gate_claim.");
  issue(issues, approval?.decision === "approved", "milestone_approval_missing", "Milestone gate decision must be approved.");
  issue(issues, approval?.approved_by?.type === "human" && typeof approval.approved_by.id === "string", "non_human_approval", "Milestone approval must identify a human approver.");
  exactKeys(approval?.subject, ["milestone_id", "milestone_manifest", "issue_drafts", "implementation_plan", "test_plan"], issues, "invalid_planning_subject_fields", "Milestone approval subject");
  issue(issues, /^milestone-\d{3}$/.test(approval?.subject?.milestone_id ?? ""), "invalid_approval_milestone", "Approval subject milestone_id must match milestone-NNN.");
  const artifactKinds = {
    milestone_manifest: "milestone_manifest",
    issue_drafts: "issue_drafts",
    implementation_plan: "implementation_plan",
    test_plan: "test_plan"
  };
  const documents = {};
  for (const [field, kind] of Object.entries(artifactKinds)) {
    const reference = approval?.subject?.[field];
    verifyFileReference(root, reference, issues, field);
    if (typeof reference?.path === "string") {
      const result = validateCommonArtifact(root, reference.path, kind);
      issues.push(...result.issues);
      documents[field] = result.document;
    }
  }
  issue(issues, documents.milestone_manifest?.milestone_id === approval?.subject?.milestone_id, "planning_manifest_milestone_mismatch", "Milestone claim and manifest IDs must match.");
  const drafts = documents.issue_drafts?.issues;
  issue(issues, Array.isArray(drafts) && drafts.length > 0, "planning_issue_drafts_missing", "Planning approval requires issue drafts.");
  for (const [index, draft] of (drafts ?? []).entries()) {
    issue(issues, draft?.write_status === "draft_only", "planning_issue_not_draft_only", "Issue must remain draft_only at milestone gate.", `issues.${index}.write_status`);
    issue(issues, draft?.external_target === null, "planning_issue_external_target_set", "Issue external_target must remain null at milestone gate.", `issues.${index}.external_target`);
  }
  const sourceShas = new Set(Object.values(documents).map((document) => document?.source_sha));
  issue(issues, sourceShas.size === 1, "planning_artifact_source_sha_mismatch", "All planning artifacts must bind to one source SHA.");
  validateExternalActions(approval?.external_actions, issues, "approval.external_actions");
  return approval;
};

const validateImplementationApproval = (root, approvalPath, issues) => {
  const approval = read(root, approvalPath);
  exactKeys(approval, ["approval_contract_version", "kind", "decision", "approved_by", "subject", "external_actions"], issues, "invalid_implementation_approval_fields", "Implementation approval");
  issue(issues, approval?.approval_contract_version === 1, "invalid_approval_contract", "approval_contract_version must equal 1.");
  issue(issues, approval?.kind === "implementation_gate_claim", "invalid_approval_kind", "Expected implementation_gate_claim.");
  issue(issues, approval?.decision === "approved", "implementation_approval_missing", "Implementation gate decision must be approved.");
  issue(issues, approval?.approved_by?.type === "human" && typeof approval.approved_by.id === "string", "non_human_approval", "Implementation approval must identify a human approver.");
  exactKeys(approval?.subject, ["milestone_id", "git_sha", "acceptance_evidence", "staging_report"], issues, "invalid_implementation_subject_fields", "Implementation approval subject");
  issue(issues, GIT_SHA_PATTERN.test(approval?.subject?.git_sha ?? ""), "invalid_approval_subject_sha", "Approval subject git_sha is required.");
  issue(issues, typeof approval?.subject?.milestone_id === "string", "missing_approval_milestone", "Approval subject milestone_id is required.");
  verifyFileReference(root, approval?.subject?.acceptance_evidence, issues, "acceptance evidence");
  verifyFileReference(root, approval?.subject?.staging_report, issues, "staging report");
  validateExternalActions(approval?.external_actions, issues, "approval.external_actions");
  return approval;
};

const validateStaging = (root, approvalPath, issues) => {
  const approval = validateImplementationApproval(root, approvalPath, issues);
  const acceptancePath = approval?.subject?.acceptance_evidence?.path;
  const stagingPath = approval?.subject?.staging_report?.path;
  if (typeof acceptancePath !== "string" || typeof stagingPath !== "string") return { approval };
  const acceptanceResult = validateCommonArtifact(root, acceptancePath, "acceptance_evidence");
  const stagingResult = validateCommonArtifact(root, stagingPath, "staging_report");
  issues.push(...acceptanceResult.issues, ...stagingResult.issues);
  const acceptance = acceptanceResult.document ?? {};
  const staging = stagingResult.document ?? {};
  issue(issues, acceptance.git_sha === approval.subject.git_sha, "approval_acceptance_sha_mismatch", "Approval Git SHA must match acceptance evidence.");
  issue(issues, staging.git_sha === approval.subject.git_sha, "approval_staging_sha_mismatch", "Approval Git SHA must match staging report.");
  issue(issues, acceptance.milestone_id === approval.subject.milestone_id, "approval_acceptance_milestone_mismatch", "Approval milestone must match acceptance evidence.");
  issue(issues, staging.milestone_id === approval.subject.milestone_id, "approval_staging_milestone_mismatch", "Approval milestone must match staging report.");
  issue(issues, Array.isArray(acceptance.results) && acceptance.results.length > 0 && acceptance.results.every((result) => result?.status === "passed"), "acceptance_not_passed", "Every acceptance result must pass.");
  issue(issues, staging.status === "passed", "staging_not_passed", "Staging status must be passed.");
  issue(issues, Array.isArray(staging.checks) && staging.checks.length > 0 && staging.checks.every((check) => check?.status === "passed"), "staging_checks_not_passed", "Every staging check must pass.");
  verifyFileReference(root, staging.environment_source, issues, "staging environment source");
  const maker = staging.implementation_author?.agent_id;
  const checker = acceptance.author?.agent_id;
  issue(issues, typeof maker === "string" && typeof checker === "string" && maker !== checker, "maker_checker_not_independent", "Implementation maker and acceptance checker must differ.");
  validateExternalActions(acceptance.external_actions, issues, "acceptance.external_actions");
  validateExternalActions(staging.external_actions, issues, "staging.external_actions");
  return { approval, acceptance, staging };
};

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.phase || !args.approval) throw new Error("--phase and --approval are required.");
  const issues = [];
  if (args.phase === "planning") {
    const approval = validatePlanningApproval(root, args.approval, issues);
    emitResult(validator, issues.length === 0 ? "approved" : "blocked", issues, {
      phase: "planning",
      milestoneId: approval?.subject?.milestone_id
    });
    return;
  }
  const staging = validateStaging(root, args.approval, issues);
  if (args.phase === "staging") {
    emitResult(validator, issues.length === 0 ? "approved" : "blocked", issues, {
      phase: "staging",
      milestoneId: staging.approval?.subject?.milestone_id,
      gitSha: staging.approval?.subject?.git_sha
    });
    return;
  }
  if (args.phase !== "release" || !args.manifest) throw new Error("Release validation requires --manifest.");
  const manifestResult = validateCommonArtifact(root, args.manifest, "release_manifest");
  issues.push(...manifestResult.issues);
  const manifest = manifestResult.document ?? {};
  issue(issues, manifest.git_sha === staging.approval?.subject?.git_sha, "release_approval_subject_sha_mismatch", "Release Git SHA must equal the approved implementation SHA.");
  issue(issues, manifest.implementation_approval?.path === args.approval, "release_approval_reference_mismatch", "Release manifest must reference the validated implementation approval.");
  verifyFileReference(root, manifest.implementation_approval, issues, "implementation approval");
  issue(issues, manifest.release_contract?.status === "accepted", "release_contract_not_accepted", "Release contract must be accepted.");
  verifyFileReference(root, manifest.release_contract, issues, "release contract");
  issue(issues, manifest.environment_contract?.status === "accepted", "environment_contract_not_accepted", "Environment contract must be accepted.");
  verifyFileReference(root, manifest.environment_contract, issues, "environment contract");
  issue(issues, typeof manifest.rollback?.procedure === "string" && manifest.rollback.procedure.length > 0, "rollback_procedure_missing", "Rollback procedure is required before release.");
  verifyFileReference(root, manifest.rollback?.evidence, issues, "rollback evidence");
  issue(issues, manifest.rollback?.status === "ready", "rollback_not_ready", "Rollback status must be ready.");
  issue(issues, manifest.authorization === "allowed", "release_not_authorized", "Release authorization must be allowed by the validated fixture contract.");
  issue(issues, manifest.execution_status === "not_executed", "release_action_executed", "Configuration eval must not execute a release action.");
  validateExternalActions(manifest.external_actions, issues, "release.external_actions");
  emitResult(validator, issues.length === 0 ? "approved" : "blocked", issues, {
    phase: "release",
    gitSha: manifest.git_sha,
    authorization: manifest.authorization,
    executionStatus: manifest.execution_status
  });
});
