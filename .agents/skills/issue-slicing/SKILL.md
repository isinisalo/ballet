---
name: issue-slicing
description: Convert an approved blueprint packet and roadmap slice into a milestone manifest and traceable draft-only implementation issues. Use after the human blueprint gate when planning a milestone, or when issue boundaries, dependencies, acceptance criteria, or external-write approvals need review.
---

# Issue Slicing

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the exact approved blueprint gate packet, its hashed artifacts, selected roadmap slice, traceability manifest, and accepted sources. Require the packet's source SHA/hashes to revalidate before slicing.

## Allowed tools

Use local reads, `rg`, YAML/dependency analysis, and read-only Git. Write only `milestone_manifest` and `issue_drafts` under the selected milestone. Read named external issues only with explicit authority; never create/update them.

## Procedure

1. Treat cross-Loop input from Ballet core as opaque, parse the documented handoff packet in this agent, and independently verify its canonical gate packet, source SHA, raw packet/artifact hashes, verifier approval, and selected slice. Ballet core does not validate these project-specific fields or hashes.
2. Define one milestone objective and exact included/deferred scope.
3. Slice work into independently reviewable issue drafts with vertical outcomes.
4. Trace each draft to source, blueprint artifact, acceptance, dependency, and risk refs.
5. Keep `external_target` nullable and `write_status: draft_only`.
6. Write artifacts and validate them before the milestone human gate.

## Output schema

Write kinds `milestone_manifest` and `issue_drafts` at catalog paths. Use `milestone-NNN` and stable `issue-draft-*` IDs.

## Checks and evidence

Report gate/hash checks, issue coverage, dependency cycles, deferred scope, proposed external actions, artifact paths/hashes, and structural and semantic check results.

## Deterministic validation

Persist the opaque handoff input to a Step-local temporary file and run `node .agents/skills/issue-slicing/scripts/validate.mjs --root <checkout-root> --handoff <handoff-file> --manifest .ballet/outputs/milestones/<milestone-id>/milestone-manifest.yaml --issues .ballet/outputs/milestones/<milestone-id>/issue-drafts.yaml`. The script must pass before `ready`; it never authorizes GitHub mutation.

## Approval boundaries

Do not write GitHub, assign people, choose a release, expand scope, or convert a draft into an external issue without explicit approval.

## Stop conditions

Stop on gate/hash drift, missing acceptance criteria, cross-milestone dependency ambiguity, incomplete coverage, or external-write authority.

## Retry and concurrency limits

Follow the shared limits. Use one milestone writer; allow read-only slicing review in parallel.
