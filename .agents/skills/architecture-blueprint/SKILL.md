---
name: architecture-blueprint
description: Derive domain boundaries, C4 context/container structure, quality scenarios, and blueprint test strategy from accepted sources and an approved roadmap. Use when producing or revising architecture blueprint artifacts without making new product, platform, data, or policy decisions.
---

# Architecture Blueprint

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the verified source snapshot, accepted same-scope Goal/ADR/spec/policy/environment sources, validated gaps, and structurally and semantically checked roadmap. Treat managed-product ADRs as inapplicable to orchestrator code.

## Allowed tools

Use local reads, `rg`, YAML/diagram analysis, and read-only Git. Write exactly one artifact selected by the current Step: `domain-map` → `domain_map`, `c4-context-container` → `c4_context_container`, `quality-scenarios` → `quality_scenarios`, or `test-strategy` → `test_strategy`. Every other artifact is read-only. Use no network or external writes.

## Procedure

1. Read the current Step ID; stop if it does not map to exactly one output above.
2. `domain-map`: require source snapshot/gaps/roadmap, derive and write only the domain map.
3. `c4-context-container`: require and preserve the validated domain map, derive and write only C4 context/container.
4. `quality-scenarios`: require and preserve roadmap/domain/C4, derive accepted measurable policies, and write only quality scenarios.
5. `test-strategy`: require and preserve all prior blueprint artifacts, derive acceptance/quality tests, and write only test strategy.
6. For the selected Step, resolve local relationships, check consistency against read-only prerequisites, validate, and never pre-create or rewrite downstream/upstream outputs.

## Output schema

Write only the current Step's one named artifact with the kind and fields documented by the project-local artifact contract. Keep technology `null` when no accepted scoped source decides it.

## Checks and evidence

Report source coverage, orphan domains/elements, conflicting responsibilities, missing measures/tests, artifact paths/hashes, and structural and semantic check results.

## Deterministic validation

Run `node .agents/skills/architecture-blueprint/scripts/validate.mjs --root <checkout-root> --kind <domain_map|c4_context_container|quality_scenarios|test_strategy> --file <current-canonical-artifact>` for the current Step only. A pass never authorizes writing another Step's artifact.

## Approval boundaries

Do not choose a new platform, framework, datastore, public API, trust boundary, retention rule, or bounded context without accepted authority.

## Stop conditions

Stop when a required responsibility, technology, quality measure, environment, or boundary needs a human decision.

## Retry and concurrency limits

Follow the shared limits. Keep one writer per artifact; allow up to three read-only consistency checks concurrently.
