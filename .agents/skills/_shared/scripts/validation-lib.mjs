import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

export const parseArgs = (argv = process.argv.slice(2)) => {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) throw new Error(`Unexpected argument: ${key ?? ""}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}.`);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
};

export const resolveInside = (root, candidate) => {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, candidate);
  const relative = path.relative(absoluteRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes validation root: ${candidate}`);
  }
  return absolute;
};

export const readYaml = (root, candidate) => {
  const absolute = resolveInside(root, candidate);
  return { absolute, document: parseYaml(readFileSync(absolute, "utf8")) };
};

export const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const sha256File = (root, candidate) => sha256Bytes(readFileSync(resolveInside(root, candidate)));

export const issue = (issues, condition, code, message, pathName) => {
  if (!condition) issues.push({ code, message, ...(pathName ? { path: pathName } : {}) });
};

export const stringArray = (value) => Array.isArray(value)
  && value.length > 0
  && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);

export const arrayOrEmpty = (value) => Array.isArray(value);

export const verifyFileReference = (root, reference, issues, label = "file reference") => {
  issue(issues, reference && typeof reference === "object", "invalid_file_reference", `${label} must be an object.`);
  if (!reference || typeof reference !== "object") return;
  issue(issues, typeof reference.path === "string" && reference.path.length > 0, "missing_reference_path", `${label} path is required.`);
  issue(issues, SHA256_PATTERN.test(reference.sha256 ?? ""), "invalid_reference_sha256", `${label} sha256 must be a lowercase digest.`);
  if (typeof reference.path !== "string" || !SHA256_PATTERN.test(reference.sha256 ?? "")) return;
  try {
    const absolute = resolveInside(root, reference.path);
    issue(issues, !path.isAbsolute(reference.path) && !reference.path.includes("\\"), "non_canonical_reference_path", `${label} path must be repository-relative POSIX.`, reference.path);
    issue(issues, !lstatSync(absolute).isSymbolicLink(), "symlink_reference_forbidden", `${label} must not be a symbolic link.`, reference.path);
    const realRoot = realpathSync(path.resolve(root));
    const realTarget = realpathSync(absolute);
    const realRelative = path.relative(realRoot, realTarget);
    issue(issues, !realRelative.startsWith("..") && !path.isAbsolute(realRelative), "reference_realpath_escape", `${label} real path escapes validation root.`, reference.path);
    issue(issues, statSync(absolute).isFile(), "missing_referenced_file", `${label} does not resolve to a file.`, reference.path);
    if (statSync(absolute).isFile()) {
      issue(issues, sha256File(root, reference.path) === reference.sha256, "reference_hash_mismatch", `${label} hash does not match raw bytes.`, reference.path);
    }
  } catch (error) {
    issues.push({ code: "missing_referenced_file", message: `${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`, path: reference.path });
  }
};

export const validateCommonArtifact = (root, file, expectedKind, options = {}) => {
  const issues = [];
  let document;
  try {
    ({ document } = readYaml(root, file));
  } catch (error) {
    return { document: undefined, issues: [{ code: "artifact_unreadable", message: error instanceof Error ? error.message : String(error), path: file }] };
  }
  issue(issues, document && typeof document === "object" && !Array.isArray(document), "invalid_artifact", "Artifact must be a YAML mapping.", file);
  if (!document || typeof document !== "object" || Array.isArray(document)) return { document, issues };
  issue(issues, document.artifact_contract_version === 1, "invalid_contract_version", "artifact_contract_version must equal 1.", file);
  issue(issues, document.kind === expectedKind, "invalid_kind", `Expected kind ${expectedKind}.`, file);
  issue(issues, typeof document.id === "string" && document.id.length > 0, "missing_artifact_id", "Artifact id is required.", file);
  issue(issues, document.canonical_path === file, "canonical_path_mismatch", "Artifact canonical_path must match the validated repository-relative path.", file);
  issue(issues, typeof document.scope === "string" && document.scope.length > 0, "missing_scope", "Artifact scope is required.", file);
  issue(issues, GIT_SHA_PATTERN.test(document.source_sha ?? ""), "invalid_source_sha", "source_sha must be a lowercase 40-character Git SHA.", file);
  if (options.selfContained !== true) {
    issue(issues, typeof document.author?.agent_id === "string" && document.author.agent_id.length > 0, "missing_author_agent", "Artifact author.agent_id is required.", file);
    issue(issues, typeof document.author?.step_id === "string" && document.author.step_id.length > 0, "missing_author_step", "Artifact author.step_id is required.", file);
    verifyFileReference(root, document.source_snapshot, issues, "source snapshot");
    if (typeof document.source_snapshot?.path === "string") {
      try {
        const snapshot = readYaml(root, document.source_snapshot.path).document;
        issue(issues, snapshot?.kind === "source_snapshot", "invalid_source_snapshot_kind", "source_snapshot must reference a source_snapshot artifact.", document.source_snapshot.path);
        issue(issues, snapshot?.source_sha === document.source_sha, "artifact_source_sha_mismatch", "Artifact source_sha must match its source snapshot.", file);
        issue(issues, snapshot?.scope === document.scope, "artifact_scope_mismatch", "Artifact scope must match its source snapshot.", file);
      } catch (error) {
        issues.push({ code: "source_snapshot_unreadable", message: error instanceof Error ? error.message : String(error), path: document.source_snapshot.path });
      }
    }
    issue(issues, Array.isArray(document.input_files) && document.input_files.length > 0, "missing_input_files", "input_files must be nonempty.", file);
    const inputPaths = new Set();
    for (const reference of document.input_files ?? []) {
      verifyFileReference(root, reference, issues, "input file");
      issue(issues, reference?.path !== file, "self_input_forbidden", "Artifact must not reference itself as input.", file);
      issue(issues, !inputPaths.has(reference?.path), "duplicate_input_file", "input_files paths must be unique.", reference?.path);
      inputPaths.add(reference?.path);
    }
  }
  return { document, issues };
};

export const validateExternalActions = (actions, issues, label = "external_actions") => {
  issue(issues, Array.isArray(actions), "invalid_external_actions", `${label} must be an array.`);
  if (!Array.isArray(actions)) return;
  for (const [index, action] of actions.entries()) {
    issue(issues, action && typeof action === "object", "invalid_external_action", "External action must be an object.", `${label}.${index}`);
    if (!action || typeof action !== "object") continue;
    issue(issues, action.status === "not_executed" || action.status === "simulated", "external_action_executed", "Eval evidence may only contain not_executed or simulated external actions.", `${label}.${index}.status`);
  }
};

export const emitResult = (validator, outcome, issues, evidence = {}) => {
  const result = {
    validator_contract_version: 1,
    validator,
    outcome,
    result: issues.length === 0 ? "passed" : "failed",
    issues,
    evidence
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (issues.length > 0) process.exitCode = 1;
};

export const runValidator = async (validator, callback) => {
  try {
    await callback();
  } catch (error) {
    emitResult(validator, "failed", [{ code: "validator_execution_failed", message: error instanceof Error ? error.message : String(error) }]);
  }
};
