#!/usr/bin/env node
import process from "node:process";
import { emitResult, issue, parseArgs, runValidator, stringArray, validateCommonArtifact } from "../../_shared/scripts/validation-lib.mjs";

const validator = "architecture-blueprint";
const supported = new Set(["domain_map", "c4_context_container", "quality_scenarios", "test_strategy"]);

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.file || !supported.has(args.kind)) throw new Error("--file and a supported --kind are required.");
  const result = validateCommonArtifact(root, args.file, args.kind);
  const issues = [...result.issues];
  const document = result.document ?? {};
  if (args.kind === "domain_map") {
    issue(issues, Array.isArray(document.domains) && document.domains.length > 0, "missing_domains", "domains must be nonempty.");
    for (const [index, domain] of (document.domains ?? []).entries()) {
      issue(issues, typeof domain?.id === "string", "missing_domain_id", "Domain ID is required.", `domains.${index}.id`);
      issue(issues, stringArray(domain?.responsibilities), "missing_domain_responsibilities", "Domain responsibilities must be nonempty.", `domains.${index}.responsibilities`);
      issue(issues, stringArray(domain?.source_refs), "missing_domain_source_refs", "Domain source_refs must be nonempty.", `domains.${index}.source_refs`);
    }
  }
  if (args.kind === "c4_context_container") {
    issue(issues, document.system && typeof document.system === "object", "missing_system_context", "system context is required.");
    issue(issues, stringArray(document.system?.source_refs), "missing_system_source_refs", "System source_refs must be nonempty.");
    issue(issues, Array.isArray(document.containers) && document.containers.length > 0, "missing_containers", "containers must be nonempty.");
    for (const [index, container] of (document.containers ?? []).entries()) {
      issue(issues, typeof container?.id === "string", "missing_container_id", "Container ID is required.", `containers.${index}.id`);
      issue(issues, Object.hasOwn(container ?? {}, "technology"), "missing_technology_field", "Container technology must be explicit, including null.", `containers.${index}.technology`);
      issue(issues, stringArray(container?.source_refs), "missing_container_source_refs", "Container source_refs must be nonempty.", `containers.${index}.source_refs`);
    }
  }
  if (args.kind === "quality_scenarios") {
    issue(issues, Array.isArray(document.scenarios) && document.scenarios.length > 0, "missing_quality_scenarios", "scenarios must be nonempty.");
    for (const [index, scenario] of (document.scenarios ?? []).entries()) {
      issue(issues, typeof scenario?.id === "string", "missing_scenario_id", "Scenario ID is required.", `scenarios.${index}.id`);
      issue(issues, scenario?.measure && typeof scenario.measure === "object", "missing_scenario_measure", "Quality measure is required.", `scenarios.${index}.measure`);
      issue(issues, stringArray(scenario?.source_refs), "missing_scenario_source_refs", "Scenario source_refs must be nonempty.", `scenarios.${index}.source_refs`);
    }
  }
  if (args.kind === "test_strategy") {
    issue(issues, Array.isArray(document.tests) && document.tests.length > 0, "missing_strategy_tests", "tests must be nonempty.");
    for (const [index, test] of (document.tests ?? []).entries()) {
      issue(issues, typeof test?.id === "string", "missing_test_id", "Test ID is required.", `tests.${index}.id`);
      issue(issues, stringArray(test?.source_refs), "missing_test_source_refs", "Test source_refs must be nonempty.", `tests.${index}.source_refs`);
      issue(issues, stringArray(test?.acceptance_refs), "missing_test_acceptance_refs", "Test acceptance_refs must be nonempty.", `tests.${index}.acceptance_refs`);
      issue(issues, typeof test?.evidence === "string" && test.evidence.length > 0, "missing_test_evidence", "Expected evidence is required.", `tests.${index}.evidence`);
    }
  }
  emitResult(validator, issues.length === 0 ? "ready" : "blocked", issues, { kind: args.kind });
});
