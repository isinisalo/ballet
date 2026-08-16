---
id: arc42-initiative-installable-loop-modules-brief
title: Installable Loop modules BRIEF
status: draft
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - initiative
  - loop-modules
---

# Installable Loop modules BRIEF

## Intent

- **Decision**: `goal-010` authorizes one-Loop import, local library install, custom Loop export and provenance-aware removal while preserving strict-v10 runtime materialization.
- **Fact**: current All Loops supports blank authoring only; runtime snapshots `.ballet/project.json`, project instructions and project skills directly.
- Owner: project owner and primary repository architect.
- Stakeholders: Loop author, operator, security reviewer and project maintainer.

## Scope

Domain/package schemas, install/export/provenance services, loopback API, Loop Library UI, seven arc42 starter packages, project documentation, migration-safe current-project exports and automated evidence.

## Non-goals

Remote registry, marketplace navigation, automatic update, executable package code, implicit graph wiring, bundled ExecutionProfiles, project config v11 and runtime package resolution.

## Constraints and interfaces

CTR-001, CTR-003–CTR-008 and CTR-010 apply. Imported JSON enters through the browser and loopback API. Materialized resources enter BB-003; Loop Runs continue through BB-004/BB-005 without a package interface.

## Quality goals and acceptance

- QS-002 remains mandatory for strict resource resolution and deterministic hashes.
- QS-004 remains mandatory for explicit network compatibility and external-write denial.
- QS-005 remains mandatory for canonical source and trace integrity.
- QS-009 requires all requested package, service, API, UI and release-smoke scenarios to pass with zero partial config reference after injected install failure.

## Evidence and authority

Human authority is this repository task dated 2026-08-16, including the package/runtime boundary, security constraints and named checks. Official method reference: `https://arc42.org/method/`; product repository and OpenAI model guidance are supporting primary sources.

## Open questions

No WHAT/WHY or acceptance blocker remains. Remote distribution and update policy require a later Goal/ADR.

## Next review basis

Ready for structures and implementation against ADR-016 and PLAN.md. This draft does not grant release, deploy, merge or push authority.
