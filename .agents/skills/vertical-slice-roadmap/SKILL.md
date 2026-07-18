---
name: vertical-slice-roadmap
description: Derive a dependency-ordered vertical-slice roadmap from accepted WHAT/WHY sources and measurable acceptance criteria. Use after source validation and gap closure when planning MVP/increments without adding product scope, architecture decisions, or implementation details.
---

# Vertical Slice Roadmap

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the verified source snapshot, accepted goals/specifications/policies, specification gaps showing no blockers, and stable acceptance IDs.

## Allowed tools

Use local reads, `rg`, YAML tooling, dependency analysis, and read-only Git. Write only `roadmap` at the catalog path. Use no network or external writes.

## Procedure

1. Extract observable outcomes, boundaries, acceptance criteria, dependencies, and risks.
2. Group them into end-to-end slices that each deliver a source-backed outcome.
3. Order slices by dependency, value, and risk without introducing a new requirement.
4. Keep infrastructure-only work inside the slice it enables unless an accepted source requires a separate milestone.
5. Cite sources and acceptance refs for every slice; expose deferred scope.
6. Write and validate the roadmap.

## Output schema

Write kind `roadmap` with stable `slices` and `risks`. Include source refs, acceptance refs, dependencies, risk IDs, and validation points for each slice.

## Checks and evidence

Report source/acceptance coverage, dependency cycles, deferred scope, risk ordering, artifact path/hash, and structural and semantic check results.

## Approval boundaries

Do not create a new capability, milestone promise, technology, policy, or acceptance criterion.

## Stop conditions

Stop on blocking gaps, missing acceptance criteria, cycles that need prioritization, or a slice requiring a new decision.

## Retry and concurrency limits

Follow the shared limits. Keep one roadmap writer; allow read-only dependency review in parallel.
