#!/usr/bin/env node
import process from "node:process";
import { emitResult, issue, parseArgs, runValidator, stringArray, validateCommonArtifact } from "../../_shared/scripts/validation-lib.mjs";

const validator = "threat-model";

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (!args.file) throw new Error("--file is required.");
  const result = validateCommonArtifact(root, args.file, "threat_model");
  const issues = [...result.issues];
  issue(issues, Array.isArray(result.document?.assets) && result.document.assets.length > 0, "missing_assets", "assets must be nonempty.");
  issue(issues, Array.isArray(result.document?.trust_boundaries) && result.document.trust_boundaries.length > 0, "missing_trust_boundaries", "trust_boundaries must be nonempty.");
  issue(issues, Array.isArray(result.document?.threats) && result.document.threats.length > 0, "missing_threats", "threats must be nonempty.");
  for (const [index, threat] of (result.document?.threats ?? []).entries()) {
    issue(issues, typeof threat?.id === "string", "missing_threat_id", "Threat ID is required.", `threats.${index}.id`);
    issue(issues, stringArray(threat?.source_refs), "missing_threat_source_refs", "Threat source_refs must be nonempty.", `threats.${index}.source_refs`);
    issue(issues, typeof threat?.mitigation === "string" && threat.mitigation.length > 0, "missing_threat_mitigation", "Threat mitigation is required.", `threats.${index}.mitigation`);
    issue(issues, typeof threat?.verification === "string" && threat.verification.length > 0, "missing_threat_verification", "Threat verification is required.", `threats.${index}.verification`);
    issue(issues, threat?.residual_risk && typeof threat.residual_risk === "object", "missing_residual_risk", "Residual risk is required.", `threats.${index}.residual_risk`);
    if (["high", "critical"].includes(threat?.residual_risk?.severity)) issue(issues, typeof threat.residual_risk.owner === "string", "unowned_high_residual_risk", "High or critical residual risk requires an owner.", `threats.${index}.residual_risk.owner`);
  }
  emitResult(validator, issues.length === 0 ? "ready" : "blocked", issues, { threatCount: result.document?.threats?.length ?? 0 });
});
