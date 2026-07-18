---
name: source-contract-audit
description: Inventory and validate Ballet source authority, scope, status, paths, references, Git SHA, and file hashes. Use before blueprint generation, after any human-owned source change, when a reference or status may be stale, or when creating/verifying a source snapshot.
---

# Source Contract Audit

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use `.ballet/source-plane.yaml`, its configured source sets, raw source bytes, and read-only Git `HEAD`/status. Do not infer an ID, scope, status, or decision from a filename, loader fallback, runtime input, proposal, or generated artifact.

## Allowed tools

Use local filesystem reads, `rg`, read-only Git commands, SHA-256 hashing, and YAML parsing. `source-inventory` may write only `source-snapshot.yaml`; `source-validation` and verifier use are strictly read-only. Use no delete, glob, directory move, network, credential, or external-write tool.

## Procedure

1. Read the current Step ID and use exactly one mode; stop if it is missing or unknown.
2. **Inventory mode (`source-inventory`):** parse the source plane and its explicit `blueprint_scope`; inventory only that scope, preserve raw bytes/canonical paths, check ID/kind/status/scope, record exact `HEAD`, contract hash, dirty/deleted paths and per-source SHA-256, write one snapshot, then verify it from disk.
3. **Validation mode (`source-validation` or verifier check):** re-read the existing snapshot and every source from disk, recompute all values, compare without writing, deleting, formatting, or repairing any file, and return diagnostics/evidence only.

## Output schema

The source-inventory Step writes kind `source_snapshot` at its catalog path with exact Git SHA, source-plane contract path/hash, dirty/deleted state, and one sorted `{source_id, kind, scope, status, path, sha256}` entry per source in `blueprint_scope`. Validation mode emits evidence only and never rewrites the snapshot.

## Checks and evidence

Report inventory count, accepted/non-accepted counts, every diagnostic code/path, structural and semantic check results, Git SHA, and snapshot path/hash. Confirm that no `.git/ballet` state or external system was written.

## Approval boundaries

Do not fix source decisions or promote status. Correct a path only with explicit authority and an unambiguous canonical target; report the correction.

## Stop conditions

Stop on any structural or semantic check error, source conflict, missing decision, unknown reference, scope mismatch, unsafe path, or hash/Git mismatch.

## Retry and concurrency limits

Follow the shared limits. Keep snapshot writing single-threaded and deterministic.
