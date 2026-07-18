#!/usr/bin/env node
import process from "node:process";
import { emitResult, issue, parseArgs, runValidator, stringArray, validateCommonArtifact } from "../../_shared/scripts/validation-lib.mjs";

const validator = "vertical-slice-roadmap";

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.file) throw new Error("--file is required.");
  const result = validateCommonArtifact(root, args.file, "roadmap");
  const issues = [...result.issues];
  const slices = result.document?.slices;
  issue(issues, Array.isArray(slices) && slices.length > 0, "missing_slices", "Roadmap slices must be nonempty.");
  const ids = new Set();
  for (const [index, slice] of (slices ?? []).entries()) {
    issue(issues, typeof slice?.id === "string", "missing_slice_id", "Slice ID is required.", `slices.${index}.id`);
    issue(issues, !ids.has(slice?.id), "duplicate_slice_id", "Slice IDs must be unique.", `slices.${index}.id`);
    ids.add(slice?.id);
    issue(issues, stringArray(slice?.source_refs), "missing_slice_source_refs", "Slice source_refs must be nonempty.", `slices.${index}.source_refs`);
    issue(issues, stringArray(slice?.acceptance_refs), "missing_slice_acceptance_refs", "Slice acceptance_refs must be nonempty.", `slices.${index}.acceptance_refs`);
    issue(issues, Array.isArray(slice?.dependencies), "invalid_slice_dependencies", "Slice dependencies must be an array.", `slices.${index}.dependencies`);
    issue(issues, Array.isArray(slice?.validation_points) && slice.validation_points.length > 0, "missing_validation_points", "Slice validation_points must be nonempty.", `slices.${index}.validation_points`);
  }
  const known = new Set(ids);
  for (const [index, slice] of (slices ?? []).entries()) {
    for (const dependency of slice?.dependencies ?? []) issue(issues, known.has(dependency), "unknown_slice_dependency", "Slice dependency must resolve.", `slices.${index}.dependencies`);
  }
  issue(issues, Array.isArray(result.document?.risks), "invalid_roadmap_risks", "Roadmap risks must be an array.");
  issue(issues, Array.isArray(result.document?.deferred_scope), "invalid_deferred_scope", "deferred_scope must be an array.");
  emitResult(validator, issues.length === 0 ? "ready" : "blocked", issues, { sliceCount: slices?.length ?? 0 });
});
