#!/usr/bin/env node
import process from "node:process";
import {
  arrayOrEmpty,
  emitResult,
  issue,
  parseArgs,
  runValidator,
  validateCommonArtifact,
  validateExternalActions
} from "../../_shared/scripts/validation-lib.mjs";

const validator = "decision-request";

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.gaps) throw new Error("--gaps is required.");
  const gapResult = validateCommonArtifact(root, args.gaps, "specification_gaps");
  const issues = [...gapResult.issues];
  const gaps = gapResult.document?.gaps;
  issue(issues, arrayOrEmpty(gaps), "invalid_gaps", "gaps must be an array.");
  const blocking = (gaps ?? []).filter((gap) => gap?.blocking === true);
  const requestResult = args.requests
    ? validateCommonArtifact(root, args.requests, "decision_requests")
    : { document: undefined, issues: [] };
  issues.push(...requestResult.issues);
  const requests = requestResult.document?.requests;
  if (blocking.length > 0) issue(issues, Array.isArray(requests) && requests.length > 0, "missing_decision_requests", "Blocking gaps require decision requests.");
  if (requests !== undefined) issue(issues, Array.isArray(requests), "invalid_decision_requests", "requests must be an array.");

  const requestIds = new Set((requests ?? []).map((request) => request?.id));
  const gapRequestIds = new Set();
  for (const [index, gap] of (gaps ?? []).entries()) {
    issue(issues, typeof gap?.id === "string", "missing_gap_id", "Gap ID is required.", `gaps.${index}.id`);
    issue(issues, Array.isArray(gap?.source_refs), "invalid_gap_source_refs", "Gap source_refs must be an array.", `gaps.${index}.source_refs`);
    if (gap?.blocking === true) {
      issue(issues, typeof gap?.request_ref === "string", "missing_gap_request_ref", "Blocking gap must reference a decision request.", `gaps.${index}.request_ref`);
      if (typeof gap?.request_ref === "string") gapRequestIds.add(gap.request_ref);
    }
  }
  for (const [index, request] of (requests ?? []).entries()) {
    issue(issues, typeof request?.id === "string", "missing_request_id", "Request ID is required.", `requests.${index}.id`);
    issue(issues, request?.status === "awaiting_human", "invalid_request_status", "Decision request must remain awaiting_human.", `requests.${index}.status`);
    issue(issues, request?.recommendation === null, "invented_recommendation", "Recommendation must be null without accepted authority.", `requests.${index}.recommendation`);
    issue(issues, Array.isArray(request?.gap_refs) && request.gap_refs.length > 0, "missing_request_gap_refs", "Decision request must reference a gap.", `requests.${index}.gap_refs`);
    issue(issues, Array.isArray(request?.target_source_paths) && request.target_source_paths.length > 0, "missing_target_sources", "Decision request must name human-owned target source paths.", `requests.${index}.target_source_paths`);
    validateExternalActions(request?.external_actions ?? [], issues, `requests.${index}.external_actions`);
  }
  issue(issues, [...gapRequestIds].every((id) => requestIds.has(id)), "gap_request_mismatch", "Every blocking gap request_ref must resolve.");
  issue(issues, [...requestIds].every((id) => gapRequestIds.has(id)), "request_gap_mismatch", "Every decision request must be referenced by a blocking gap.");
  const expectedOpen = [...requestIds].sort();
  const gapOpen = [...(gapResult.document?.open_decision_refs ?? [])].sort();
  const requestOpen = [...(requestResult.document?.open_decision_refs ?? [])].sort();
  issue(issues, JSON.stringify(gapOpen) === JSON.stringify(expectedOpen), "gap_open_refs_mismatch", "Gap open_decision_refs must exactly match requests.");
  if (requestResult.document) issue(issues, JSON.stringify(requestOpen) === JSON.stringify(expectedOpen), "request_open_refs_mismatch", "Request open_decision_refs must exactly match requests.");
  emitResult(validator, issues.length === 0 ? (blocking.length > 0 ? "needs_input" : "ready") : "blocked", issues, {
    gapCount: gaps?.length ?? 0,
    blockingGapCount: blocking.length,
    requestCount: requests?.length ?? 0
  });
});
