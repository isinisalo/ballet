---
name: traceability
description: Build and verify source-to-artifact-to-acceptance-to-test traceability for Ballet blueprints and delivery evidence. Use before a blueprint, milestone, implementation, staging, or release gate, or when any source, artifact, acceptance criterion, test, or evidence reference changes.
---

# Traceability

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the validated source snapshot, accepted sources with stable acceptance IDs, structurally and semantically checked artifacts, test strategy/plan, and persisted evidence files. Do not use summaries as substitutes for artifact contents.

## Allowed tools

Use local reads, `rg`, YAML tooling, SHA-256, and read-only Git. Only the `traceability` authoring Step may write `traceability_manifest`; verifier/review/gate use is strictly read-only and must recompute the persisted graph without repairing it. Use no network or external writes.

## Procedure

1. Read the current Step ID; select author mode only for `traceability`, otherwise select read-only verify mode.
2. Index unique owner/status/scope-aware source, artifact, acceptance, and test IDs; reject wrong-kind, dangling, cross-scope, proposal-owned, self, or cyclic links.
3. In author mode, create source-to-artifact-to-acceptance-to-test links; every link contains at least one accepted criterion, artifact, and test. Compute uncovered sets, write only the canonical manifest, validate, then recompute from disk.
4. In verify mode, read and recompute the existing manifest and coverage only. Do not write, delete, normalize, or repair the manifest or any upstream artifact.
5. Preserve gaps explicitly; never backfill coverage with an assumption or prose-only claim.

## Output schema

Author mode writes kind `traceability_manifest` with complete `links` and exact uncovered sets. Verify mode produces no artifact. A source or acceptance criterion is covered only by an authorized same-scope link that reaches a declared test.

## Checks and evidence

Report counts for each registry, duplicate/dangling references, coverage ratios, manifest path/hash, and structural and semantic check results.

## Deterministic validation

Run `node .agents/skills/traceability/scripts/validate.mjs --root <checkout-root> --file .ballet/outputs/traceability-manifest.yaml` in author mode and read-only verifier mode. Verifier mode must not rewrite the manifest after failure.

## Approval boundaries

Do not change a source, acceptance criterion, test, or upstream artifact to make coverage appear complete.

## Stop conditions

Stop on duplicate IDs, unknown/wrong-kind refs, cycles, unapproved sources, scope mismatch, or material uncovered coverage.

## Retry and concurrency limits

Follow the shared limits. Build one deterministic manifest per scope and source snapshot.
