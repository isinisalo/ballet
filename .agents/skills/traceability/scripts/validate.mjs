#!/usr/bin/env node
import process from "node:process";
import { emitResult, issue, parseArgs, runValidator, validateCommonArtifact } from "../../_shared/scripts/validation-lib.mjs";

const validator = "traceability";

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.file) throw new Error("--file is required.");
  const result = validateCommonArtifact(root, args.file, "traceability_manifest");
  const issues = [...result.issues];
  const registries = result.document?.registries ?? {};
  const registrySets = {};
  for (const name of ["sources", "artifacts", "acceptance", "tests"]) {
    const values = registries[name];
    issue(issues, Array.isArray(values) && values.length > 0, "missing_trace_registry", `Trace registry ${name} must be nonempty.`, `registries.${name}`);
    const ids = (values ?? []).map((entry) => typeof entry === "string" ? entry : entry?.id);
    issue(issues, ids.every((id) => typeof id === "string" && id.length > 0), "invalid_trace_registry_id", `Trace registry ${name} contains an invalid ID.`, `registries.${name}`);
    issue(issues, new Set(ids).size === ids.length, "duplicate_trace_registry_id", `Trace registry ${name} IDs must be unique.`, `registries.${name}`);
    registrySets[name] = new Set(ids);
  }
  const links = result.document?.links;
  issue(issues, Array.isArray(links) && links.length > 0, "missing_trace_links", "Trace links must be nonempty.");
  for (const [index, link] of (links ?? []).entries()) {
    const mappings = {
      source_ref: "sources",
      artifact_ref: "artifacts",
      acceptance_ref: "acceptance",
      test_ref: "tests"
    };
    for (const [key, registry] of Object.entries(mappings)) {
      issue(issues, typeof link?.[key] === "string" && link[key].length > 0, "incomplete_trace_link", `Trace link ${key} is required.`, `links.${index}.${key}`);
      if (typeof link?.[key] === "string") issue(issues, registrySets[registry]?.has(link[key]), "dangling_trace_reference", `Trace link ${key} must resolve in ${registry}.`, `links.${index}.${key}`);
    }
  }
  const coveredSources = new Set((links ?? []).filter((link) => registrySets.tests?.has(link?.test_ref)).map((link) => link.source_ref));
  const sourceCount = registrySets.sources?.size ?? 0;
  const computedCoverage = sourceCount === 0 ? 0 : coveredSources.size / sourceCount;
  const computedUncovered = [...(registrySets.sources ?? [])].filter((id) => !coveredSources.has(id)).sort();
  issue(issues, result.document?.coverage?.source_to_test === computedCoverage, "forged_source_to_test_coverage", "Persisted source_to_test coverage must equal recomputed coverage.");
  issue(issues, computedCoverage === 1, "incomplete_source_to_test_coverage", "Recomputed source_to_test coverage must equal 1 for approval.");
  issue(issues, JSON.stringify([...(result.document?.uncovered ?? [])].sort()) === JSON.stringify(computedUncovered), "uncovered_traceability_mismatch", "Persisted uncovered IDs must equal recomputed uncovered IDs.");
  issue(issues, computedUncovered.length === 0, "uncovered_traceability", "Recomputed uncovered set must be empty for approval.");
  emitResult(validator, issues.length === 0 ? "ready" : "blocked", issues, { linkCount: links?.length ?? 0, computedCoverage, computedUncovered });
});
