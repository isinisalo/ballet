---
name: independent-blueprint-review
description: Independently verify a complete Ballet blueprint against accepted sources, documented structures, hashes, traceability, gaps, risks, and approval boundaries, then assemble the human blueprint gate packet. Use only after all authoring artifacts exist and before human blueprint approval.
---

# Independent Blueprint Review

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Read persisted source snapshot and all blueprint artifacts directly from catalog paths. Re-read accepted sources and Git state. Never rely on author summaries, expected verdicts, or truncated runtime history.

## Allowed tools

Use local read-only inspection, `rg`, YAML validation, SHA-256, and read-only Git. Keep reviewed artifacts read-only. Write only `blueprint_review` first and then `blueprint_gate_packet`. Use no network or external writes.

## Procedure

1. Prove reviewer independence from every artifact author.
2. Recompute source SHA/status/path/hash integrity and check every artifact against its documented project-local structure and semantics.
3. Verify scope, source authority, assumptions, gaps/conflicts, quality/threat/UX consistency, and complete traceability.
4. Record findings and checks in `blueprint_review`; use `approved` only with no error finding, no skipped/failed check, no gap/conflict/open decision/new assumption, and complete source-to-test coverage.
5. If verdict is `changes_requested` or `blocked`, write no gate packet, return that outcome, and stop. If a stale canonical packet already exists, report its exact path as blocking without deleting or rewriting it. Do not continue to hashing or packet assembly.
6. Only for an approved review, hash the reviewed artifacts and review file from raw bytes.
7. Assemble the gate packet with source SHA, artifact hashes, new assumptions, open decisions, exact roadmap/residual-threat risks, coverage, verifier ID, and all proposed external actions as `not_executed`.
8. Rerun every project-local structural and semantic check and expose the packet for human review.

## Output schema

Always write kind `blueprint_review`. Write kind `blueprint_gate_packet` only after an approved review; an existing packet from another verdict or snapshot is blocking stale output. Do not include a self-hash. Bind every reviewed artifact and the packet to the exact same verified source snapshot.

## Checks and evidence

Report independence proof, every structural and semantic check result, recomputed hashes, findings, coverage, artifact paths, and packet hash.

## Approval boundaries

Do not repair author artifacts, source decisions, or implementation. Do not approve the human gate or execute proposed external actions.

## Stop conditions

Return `changes-requested` for same-scope artifact repair; return `blocked` for source/decision/approval gaps or independence failure. Never emit an approvable packet with hidden or unresolved blocking gaps.

## Retry and concurrency limits

Follow the shared limits. Run independent read-only checks concurrently, but serialize review and packet writes after all checks finish.
