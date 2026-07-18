#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
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
  sha256File
} from "../../_shared/scripts/validation-lib.mjs";

const validator = "source-contract-audit";

const markdownMetadata = (source, file) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Markdown source has no YAML frontmatter: ${file}`);
  return parseYaml(match[1]);
};

const filesAt = (directory, recursive) => {
  if (!statSync(directory).isDirectory()) return [];
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) output.push(...filesAt(target, true));
    else if (entry.isFile()) output.push(target);
  }
  return output.sort();
};

const validateSnapshot = (root, snapshotPath, planePath, requirementsPath) => {
  const issues = [];
  const snapshot = parseYaml(readFileSync(resolveInside(root, snapshotPath), "utf8"));
  issue(issues, snapshot?.artifact_contract_version === 1, "invalid_contract_version", "Snapshot contract version must equal 1.");
  issue(issues, snapshot?.kind === "source_snapshot", "invalid_kind", "Expected source_snapshot.");
  issue(issues, typeof snapshot?.id === "string", "missing_snapshot_id", "Snapshot id is required.");
  issue(issues, snapshot?.canonical_path === snapshotPath, "snapshot_canonical_path_mismatch", "Snapshot canonical_path must match its persisted path.");
  issue(issues, typeof snapshot?.scope === "string" && snapshot.scope.length > 0, "missing_scope", "Snapshot scope is required.");
  issue(issues, typeof snapshot?.author?.agent_id === "string", "missing_author_agent", "Snapshot author.agent_id is required.");
  issue(issues, typeof snapshot?.author?.step_id === "string", "missing_author_step", "Snapshot author.step_id is required.");
  issue(issues, GIT_SHA_PATTERN.test(snapshot?.source_sha ?? ""), "invalid_source_sha", "Snapshot source_sha must be a Git SHA.");
  issue(issues, typeof snapshot?.source_plane?.path === "string", "missing_source_plane_path", "Snapshot source_plane.path is required.");
  issue(issues, SHA256_PATTERN.test(snapshot?.source_plane?.sha256 ?? ""), "invalid_source_plane_hash", "Snapshot source_plane.sha256 is required.");
  if (typeof snapshot?.source_plane?.path === "string" && SHA256_PATTERN.test(snapshot?.source_plane?.sha256 ?? "")) {
    issue(issues, sha256File(root, snapshot.source_plane.path) === snapshot.source_plane.sha256, "source_plane_hash_drift", "Source-plane bytes no longer match the snapshot.", snapshot.source_plane.path);
  }
  issue(issues, Array.isArray(snapshot?.dirty_paths), "invalid_dirty_paths", "dirty_paths must be an array.");
  issue(issues, Array.isArray(snapshot?.deleted_paths), "invalid_deleted_paths", "deleted_paths must be an array.");
  issue(issues, Array.isArray(snapshot?.sources) && snapshot.sources.length > 0, "missing_sources", "Snapshot sources must be nonempty.");
  const seenIds = new Set();
  for (const [index, source] of (snapshot?.sources ?? []).entries()) {
    const label = `sources.${index}`;
    issue(issues, typeof source?.source_id === "string", "missing_source_id", "Snapshot source_id is required.", label);
    issue(issues, !seenIds.has(source?.source_id), "duplicate_snapshot_source_id", "Snapshot source IDs must be unique.", label);
    seenIds.add(source?.source_id);
    issue(issues, typeof source?.kind === "string" && typeof source?.scope === "string" && typeof source?.status === "string", "incomplete_snapshot_source", "Snapshot source kind, scope and status are required.", label);
    issue(issues, typeof source?.path === "string", "missing_source_path", "Snapshot source path is required.", label);
    issue(issues, SHA256_PATTERN.test(source?.sha256 ?? ""), "invalid_source_hash", "Snapshot source hash must be a lowercase SHA-256.", label);
    if (typeof source?.path === "string" && SHA256_PATTERN.test(source?.sha256 ?? "")) {
      try {
        issue(issues, sha256File(root, source.path) === source.sha256, "source_hash_drift", "Persisted source bytes no longer match the snapshot.", source.path);
      } catch (error) {
        issues.push({ code: "source_unreadable", message: error instanceof Error ? error.message : String(error), path: source.path });
      }
    }
  }
  const sorted = [...(snapshot?.sources ?? [])].sort((left, right) => String(left.path).localeCompare(String(right.path)) || String(left.source_id).localeCompare(String(right.source_id)));
  issue(issues, JSON.stringify(snapshot?.sources ?? []) === JSON.stringify(sorted), "snapshot_sources_not_sorted", "Snapshot sources must be deterministically sorted.");
  try {
    const gitHead = execFileSync("git", ["-C", resolveInside(root, "."), "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    issue(issues, gitHead === snapshot?.source_sha, "snapshot_git_head_drift", "Snapshot source_sha does not match Git HEAD.");
  } catch {
    issue(issues, snapshot?.evaluation_fixture === true, "snapshot_git_head_unverified", "A non-Git validation root must explicitly declare evaluation_fixture: true.");
  }
  if (planePath) {
    issue(issues, snapshot?.source_plane?.path === planePath, "snapshot_source_plane_path_mismatch", "Snapshot source_plane path must match the requested source plane.");
    const inventory = validateInventory(root, planePath, requirementsPath);
    issues.push(...inventory.issues);
    const current = inventory.sources
      .map((source) => ({ source_id: source.id, kind: source.kind, scope: source.scope, status: source.status, path: source.path, sha256: source.sha256 }))
      .sort((left, right) => left.path.localeCompare(right.path) || left.source_id.localeCompare(right.source_id));
    issue(issues, JSON.stringify(current) === JSON.stringify(snapshot?.sources ?? []), "snapshot_inventory_drift", "Snapshot inventory no longer matches the source-plane inventory.");
  }
  return { issues, evidence: { sourceCount: snapshot?.sources?.length ?? 0, snapshot: snapshotPath, sourceSha: snapshot?.source_sha } };
};

const validateInventory = (root, planePath, requirementsPath) => {
  const issues = [];
  const gaps = [];
  const conflicts = [];
  const sources = [];
  const plane = parseYaml(readFileSync(resolveInside(root, planePath), "utf8"));
  const scope = plane?.blueprint_scope;
  const scopeDefinition = plane?.scopes?.[scope];
  issue(issues, typeof scope === "string" && scope.length > 0, "missing_blueprint_scope", "blueprint_scope is required.");
  issue(issues, scopeDefinition && typeof scopeDefinition === "object", "unknown_blueprint_scope", "blueprint_scope must resolve to a configured scope.");
  const allowed = new Set(scopeDefinition?.allowed_source_sets ?? []);
  const accepted = new Set(plane?.authority?.accepted_statuses ?? ["accepted"]);
  const sets = (plane?.source_sets ?? []).filter((set) => allowed.has(set.id));
  for (const set of sets) {
    let directory;
    try { directory = resolveInside(root, set.path); }
    catch (error) {
      issues.push({ code: "source_path_escape", message: error instanceof Error ? error.message : String(error), path: set.path });
      continue;
    }
    let candidates = [];
    try { candidates = filesAt(directory, set.recursive === true); }
    catch {
      if (set.required === true) gaps.push({ code: "required_source_set_missing", source_set: set.id, path: set.path });
      continue;
    }
    const extension = set.format === "markdown" ? ".md" : set.format === "yaml" ? [".yaml", ".yml"] : undefined;
    candidates = candidates.filter((file) => Array.isArray(extension) ? extension.includes(path.extname(file)) : !extension || file.endsWith(extension));
    if (set.required === true && candidates.length === 0) gaps.push({ code: "required_source_set_empty", source_set: set.id, path: set.path });
    for (const absolute of candidates) {
      const relative = path.relative(path.resolve(root), absolute).split(path.sep).join("/");
      try {
        const sourceText = readFileSync(absolute, "utf8");
        const metadata = set.format === "markdown" ? markdownMetadata(sourceText, relative) : parseYaml(sourceText);
        const id = set.fixed_id ?? metadata?.id;
        const status = set.fixed_status ?? metadata?.status;
        if (typeof id !== "string" || id.length === 0) issues.push({ code: "missing_source_id", message: "Source ID is required.", path: relative });
        if (!accepted.has(status)) gaps.push({ code: "source_not_accepted", source_id: id ?? null, status: status ?? null, path: relative });
        sources.push({ id, status, kind: set.kind, scope: set.scope, source_set: set.id, path: relative, sha256: sha256File(root, relative), metadata });
      } catch (error) {
        issues.push({ code: "source_parse_failed", message: error instanceof Error ? error.message : String(error), path: relative });
      }
    }
    if (set.index) {
      try {
        const index = parseYaml(readFileSync(resolveInside(root, set.index), "utf8"));
        const entries = index?.goals ?? index?.sources ?? [];
        for (const entry of entries) {
          const matched = sources.find((source) => source.path === entry.path);
          if (!matched || matched.id !== entry.id || matched.status !== entry.status) {
            issues.push({ code: "source_index_mismatch", message: "Source index entry does not match persisted source metadata.", path: entry.path });
          }
        }
        const indexedPaths = new Set(entries.map((entry) => entry.path));
        for (const source of sources.filter((candidate) => candidate.source_set === set.id)) {
          if (!indexedPaths.has(source.path)) issues.push({ code: "source_missing_from_index", message: "Persisted source is missing from its required index.", path: source.path });
        }
      } catch (error) {
        issues.push({ code: "source_index_unreadable", message: error instanceof Error ? error.message : String(error), path: set.index });
      }
    }
  }

  const byId = new Map();
  for (const source of sources) {
    const previous = byId.get(source.id);
    if (previous) conflicts.push({ code: "duplicate_source_id", source_ids: [previous.id, source.id], paths: [previous.path, source.path] });
    else byId.set(source.id, source);
  }
  const claims = new Map();
  for (const source of sources.filter((candidate) => accepted.has(candidate.status))) {
    for (const [key, value] of Object.entries(source.metadata?.claims ?? {})) {
      const serialized = JSON.stringify(value);
      const previous = claims.get(key);
      if (previous && previous.value !== serialized) conflicts.push({ code: "accepted_claim_conflict", claim: key, sources: [previous.source, source.id], values: [JSON.parse(previous.value), value] });
      else claims.set(key, { value: serialized, source: source.id });
    }
    for (const other of source.metadata?.conflicts_with ?? []) conflicts.push({ code: "declared_source_conflict", sources: [source.id, other] });
  }

  if (requirementsPath) {
    const requirements = parseYaml(readFileSync(resolveInside(root, requirementsPath), "utf8"));
    for (const kind of requirements?.required_kinds ?? []) {
      if (!sources.some((source) => source.kind === kind && accepted.has(source.status))) gaps.push({ code: "required_source_kind_missing", kind });
    }
    for (const key of requirements?.required_metadata_any_source ?? []) {
      if (!sources.some((source) => source.metadata?.[key] !== undefined)) gaps.push({ code: "required_source_metadata_missing", key });
    }
  }
  return { issues, gaps, conflicts, sources };
};

runValidator(validator, async () => {
  const args = parseArgs();
  const root = args.root ?? process.cwd();
  if (args.snapshot) {
    const result = validateSnapshot(root, args.snapshot, args["source-plane"], args.requirements);
    emitResult(validator, result.issues.length === 0 ? "ready" : "blocked", result.issues, result.evidence);
    return;
  }
  if (!args["source-plane"]) throw new Error("--source-plane is required unless --snapshot is used.");
  const result = validateInventory(root, args["source-plane"], args.requirements);
  const outcome = result.issues.length > 0 ? "blocked" : result.gaps.length > 0 || result.conflicts.length > 0 ? "needs_input" : "ready";
  const findings = [
    ...result.issues,
    ...result.gaps.map((gap) => ({ ...gap, message: "Required source authority is missing or unaccepted." })),
    ...result.conflicts.map((conflict) => ({ ...conflict, message: "Accepted source authority is conflicting." }))
  ];
  emitResult(validator, outcome, findings, {
    sourceCount: result.sources.length,
    sources: result.sources.map(({ id, status, kind, scope, path, sha256 }) => ({ id, status, kind, scope, path, sha256 })),
    gapCount: result.gaps.length,
    conflictCount: result.conflicts.length
  });
});
