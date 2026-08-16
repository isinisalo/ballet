---
id: ballet-architecture-entrypoint
title: Ballet architecture entrypoint
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 2
tags:
  - architecture
  - arc42
  - entrypoint
---

# Ballet architecture

## Purpose

This is the shared human and agent entrypoint to Ballet's version-controlled architecture and continuous development method.

## Status

The arc42 structure and 6+1 Ballet Method are accepted by `goal-009` and `adr-011`. Installable one-Loop authoring packages are accepted by `goal-010` and `adr-016`; they materialize into project-local runtime sources and never become a live runtime dependency.

## Canonical sources

- [arc42 index](.ballet/arc42/README.md)
- [persistent project status and handoff](.ballet/arc42/STATUS.md)
- [traceability](.ballet/arc42/TRACEABILITY.md)
- [method health](.ballet/arc42/METHOD-HEALTH.md)
- [State contract](.ballet/arc42/STATE-CONTRACT.md)
- [Goals](.ballet/goals/summary.md)
- [Architecture decisions](.ballet/arc42/09-architecture-decisions.md)
- [UI design system](DESIGN.md)

## Relevant decisions

`adr-011` defines the source-of-truth and method. `adr-015` defines Work/Validation, State revisions, repair and continuation. `adr-016` defines the package/install boundary and partially supersedes only ADR-014's no-package V1 scope. Existing accepted Goals and ADRs remain authoritative.

## Evidence

Run `npm run validate:arc42` to validate documents, traceability, project resources and the strict-v10 Loop graph. Package/service/API/UI tests validate module materialization; the packaged release smoke lists project-provided library packages. Runtime UI and State revisions remain the execution truth for an active Root Run.

## Open questions

- Which bounded initiative will be the first pilot?
- What baseline values will the first pilot establish for method-health metrics?

## Next review basis

Review after the first initiative completes the clarify → structures → concepts → communicate → implementation → evaluate flow.
