#!/usr/bin/env node
import process from "node:process";
import { emitResult, issue, parseArgs, runValidator, stringArray, validateCommonArtifact } from "../../_shared/scripts/validation-lib.mjs";

const validator = "ui-flow-design";
const requiredStates = ["success", "empty", "loading", "error", "permission_denied"];

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.file) throw new Error("--file is required.");
  const result = validateCommonArtifact(root, args.file, "ux_information_architecture");
  const issues = [...result.issues];
  issue(issues, Array.isArray(result.document?.actors) && result.document.actors.length > 0, "missing_actors", "actors must be nonempty.");
  issue(issues, Array.isArray(result.document?.journeys) && result.document.journeys.length > 0, "missing_journeys", "journeys must be nonempty.");
  issue(issues, Array.isArray(result.document?.views) && result.document.views.length > 0, "missing_views", "views must be nonempty.");
  for (const [index, journey] of (result.document?.journeys ?? []).entries()) {
    issue(issues, stringArray(journey?.source_refs), "missing_journey_source_refs", "Journey source_refs must be nonempty.", `journeys.${index}.source_refs`);
    issue(issues, stringArray(journey?.acceptance_refs), "missing_journey_acceptance_refs", "Journey acceptance_refs must be nonempty.", `journeys.${index}.acceptance_refs`);
  }
  for (const [index, view] of (result.document?.views ?? []).entries()) {
    issue(issues, typeof view?.id === "string", "missing_view_id", "View ID is required.", `views.${index}.id`);
    issue(issues, Array.isArray(view?.states), "missing_view_states", "View states must be an array.", `views.${index}.states`);
    for (const state of requiredStates) issue(issues, view?.states?.includes(state), "missing_required_view_state", `View must expose ${state}.`, `views.${index}.states`);
    issue(issues, stringArray(view?.source_refs), "missing_view_source_refs", "View source_refs must be nonempty.", `views.${index}.source_refs`);
  }
  emitResult(validator, issues.length === 0 ? "ready" : "blocked", issues, { journeyCount: result.document?.journeys?.length ?? 0 });
});
