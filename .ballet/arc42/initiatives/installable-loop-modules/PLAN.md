---
id: arc42-initiative-installable-loop-modules-plan
title: Installable Loop modules PLAN
status: draft
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - initiative
  - loop-modules
---

# Installable Loop modules PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| installable-loop-modules-step-001 | goal-010 / REQ-010 | QS-009 | adr-016 / CON-007 | BB-003, BB-009 | RT-006 | shared domain and strict Zod package contract | package schema/unit tests | ILM-EVID-001 |
| installable-loop-modules-step-002 | goal-010 / REQ-010 | QS-002, QS-004, QS-009 | adr-016 / CON-001, CON-003, CON-007 | BB-002, BB-003, BB-009 | RT-006, RT-007 | install/export/provenance services and loopback API | service/API/transaction tests | ILM-EVID-002 |
| installable-loop-modules-step-003 | goal-007, goal-010 / REQ-007, REQ-010 | QS-001, QS-009 | adr-016 / CON-005, CON-007 | BB-001, BB-009 | RT-006 | Add Loop Library and installed-card actions | keyboard/responsive UI tests | ILM-EVID-003 |
| installable-loop-modules-step-004 | goal-009, goal-010 / REQ-009, REQ-010 | QS-005, QS-009 | adr-011, adr-016 / CON-006, CON-007 | BB-008, BB-009 | RT-006 | seven arc42 packages, docs, trace and release fixture | arc42 validation and release smoke | ILM-EVID-004 |
| installable-loop-modules-step-005 | goal-010 / REQ-010 | QS-009 | adr-016 / CON-007 | BB-001–BB-003, BB-009 | RT-006, RT-007 | bounded diff and conformance review | full requested check set | ILM-EVID-005 |

## Ordering and migration

Decisions and contracts precede services; services precede API/UI; starter packages are generated from the unchanged current seven arc42 Loop semantics. Existing Loops remain custom until an explicit exact semantic/hash adopt operation. No config-version migration or legacy parallel runtime path is introduced.

## Failure and rollback implications

Install writes new namespaced resources and provenance before atomic project config. A failed config write compensates only artifacts created by that attempt. Remove updates config before best-effort orphan cleanup and never deletes a referenced/shared resource.

## Risks

RISK-008 untrusted prompt supply chain, RISK-009 stale plan/partial install and RISK-010 provenance drift are controlled by strict limits, canonical hashes, revalidation, namespacing and content-derived status.

## Checks

`npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build`, `git diff --check`, design lint if DESIGN changes, platform-boundary grep and packaged release smoke.

## Open questions

None in scope. The plan grants no external-write authority.
