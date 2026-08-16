---
id: arc42-migration-decisions
title: arc42 migration decisions and safe sequence
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - migration
  - decisions
---

# arc42 migration decisions and safe sequence

## Purpose

Record migration-specific choices and the order that prevents broken references or parallel active truths.

## Status

Decisions accepted for this repository migration.

## Migration decisions

1. Fill the first free IDs `goal-009` and `adr-011`; do not renumber existing records.
2. Keep every accepted Goal and ADR canonical. Index them; do not rewrite their semantic decisions.
3. Use English for concise arc42 architecture content and retain existing Finnish Goal/ADR wording. Stable IDs and paths bridge language choice.
4. Keep `DESIGN.md` as the sole UI design-system source.
5. Treat absent ROADMAP/C4/milestone/ACCEPTANCE files as unfulfilled old task targets, not evidence.
6. Replace the project-local topology only; strict-v10 platform primitives are sufficient.
7. Keep release-validation separate from default development flow and place Human Validation before external writes.
8. Use Sol/medium for architecture and evaluation, Terra/medium for implementation/external execution and Luna/medium for mechanical validation/orchestration. Network remains off except explicit research and authorized release nodes.
9. Use a weekly Monday 09:00 Europe/Helsinki scheduled learning start with `startsOn: 2026-08-17`, the next Monday after implementation date.
10. Reduce historical output documents to superseded pointers after content migration; remove migrated instructions only after all config references resolve to new resources.

## Safe apply/supersede order

1. Inventory sources and conflicts in ASSESSMENT/CONTENT-MAP.
2. Create and accept goal-009/adr-011 from explicit user authorization.
3. Create the arc42 sections, support docs, initiative template and State contract.
4. Create role instructions and focused skills.
5. Replace `.ballet/project.json` with the strict-v10 6+1 graph and unchained release support.
6. Validate schema, graph, State equality, profiles and resource catalog while legacy files still exist.
7. Remove all `migrated-*` instructions and supersede output duplicates after zero active reference remains.
8. Update README, AGENTS and Goal summary; run deterministic validator, tests, lint, build, boundary grep and diff checks.
9. Do not commit, push, merge, release, deploy or write to external systems.

If a validation fails, repair the new canonical source or restore its reference before removing another legacy source. Do not introduce a runtime compatibility reader.

## Canonical sources

`adr-011` owns the final architecture decision; this file owns only migration execution choices.

## Relevant decisions

`adr-002`, `adr-011`–`adr-015`.

## Evidence

Git diff, validator output, resource catalog results and required repository checks.

## Open questions

- None for migration. The first pilot remains a separate initiative decision.

## Next review basis

Supersede this migration record only if a later repository migration replaces its source/target contract.
