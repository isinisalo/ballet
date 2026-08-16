---
id: arc42-traceability
title: Ballet architecture traceability
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 3
tags:
  - arc42
  - traceability
  - evidence
---

# Ballet architecture traceability

## Purpose

Connect accepted intent to measurable evidence without duplicating the canonical content behind each stable ID.

## Status

The baseline covers the highest-risk architecture qualities and the new continuous method. Pending evidence is explicit.

## Trace matrix

<!-- traceability:start -->
| Goal/Requirement | Quality Scenario | ADR/Concept | Building Block | Runtime/Deployment Scenario | Test/Monitor | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| goal-001 / REQ-001 | QS-001 | adr-001 / CON-001 | BB-001 / BB-002 | RT-001 / DEP-001 | TEST-001 | EVID-001 | verified |
| goal-002 / REQ-002 | QS-002 | adr-002 / CON-004 | BB-003 / BB-008 | RT-001 / DEP-001 | TEST-002 | EVID-002 | verified |
| goal-004 / REQ-004 | QS-003 | adr-015 / CON-002 | BB-004 / BB-005 | RT-003 / DEP-002 | TEST-003 | EVID-003 | verified |
| goal-005 / REQ-005 | QS-004 | adr-006 / CON-001 | BB-004 / BB-007 | RT-001 / DEP-002 | TEST-004 | EVID-004 | verified |
| goal-009 / REQ-009 | QS-005 | adr-011 / CON-006 | BB-003 / BB-008 | RT-004 / DEP-001 | TEST-005 | EVID-005 | verified |
| goal-009 / REQ-009 | QS-006 | adr-011 / CON-006 | BB-004 / BB-008 | RT-003 / DEP-002 | TEST-006 | EVID-006 | pending pilot |
| goal-008 / REQ-008 | QS-007 | adr-009 / CON-001 | BB-007 | RT-005 / DEP-003 | TEST-007 | EVID-007 | policy verified; execution pending |
| goal-009 / REQ-009 | QS-008 | adr-011 / CON-006 | BB-003 / BB-008 | RT-004 / DEP-001 | TEST-008 | EVID-008 | pending pilot |
| goal-010 / REQ-010 | QS-009 | adr-016 / CON-007 | BB-001 / BB-002 / BB-003 / BB-009 | RT-006 / RT-007 / DEP-001 | TEST-009 | EVID-009 | implementation verified; full gate pending |
| goal-011 / REQ-011 | QS-010 | adr-017 / CON-005 | BB-001 / BB-009 | RT-006 / DEP-001 | TEST-010 | EVID-010 | verified |
<!-- traceability:end -->

## Test and monitor catalog

| ID | Check | Owner |
| --- | --- | --- |
| TEST-001 | Local server, API security and checkout lifecycle tests | platform test suite |
| TEST-002 | Strict project configuration and resource-catalog tests | project configuration tests |
| TEST-003 | Work Loop, State patch, repair allowlist and continuation tests | runtime test suite |
| TEST-004 | Git workspace and permission-policy tests | execution test suite |
| TEST-005 | `npm run validate:arc42` structural and link validation | project-local validator |
| TEST-006 | First initiative trace completeness and handoff review | arc42 evaluate Loop |
| TEST-007 | Release authorization gate and release-validation evidence | release-validation Loop |
| TEST-008 | Method-health comparison against the first pilot baseline | continuous learning/evaluate Loops |
| TEST-009 | Loop module package/service/API/UI tests, strict build gates and packaged Loop Library smoke | module platform test suite |
| TEST-010 | Loop Engineer typed routing, pure projection, keyboard/UI and desktop/narrow browser checks | frontend and module test suites |

## Evidence catalog

| ID | Evidence | Location |
| --- | --- | --- |
| EVID-001 | Existing automated local-service and HTTP test results | `npm run test` |
| EVID-002 | Strict-v10 schema and resource-resolution results | `npm run validate:arc42`, `npm run test` |
| EVID-003 | Existing Work Loop runtime and persistence results | `npm run test` |
| EVID-004 | Existing worktree and permission-policy results | `npm run test` |
| EVID-005 | arc42 repository conformance report | `npm run validate:arc42` |
| EVID-006 | Initiative BRIEF/PLAN/EVIDENCE/REVIEW chain | pending first initiative |
| EVID-007 | Human authorization plus release/deploy/rollback checks | pending an explicitly authorized release |
| EVID-008 | Before/after method metrics | pending first pilot evaluation |
| EVID-009 | Installable Loop modules initiative evidence | `.ballet/arc42/initiatives/installable-loop-modules/EVIDENCE.md` |
| EVID-010 | Three-level Loop Engineer implementation evidence | `.ballet/arc42/initiatives/loop-engineer-three-level-canvas/EVIDENCE.md` |

## Canonical sources

Goals, quality scenarios, ADRs/concepts, building blocks, runtime/deployment scenarios and evidence catalogs remain authoritative in their linked documents; this file owns only their relationship and current trace status.

## Relevant decisions

`adr-011`, `adr-015`, `adr-016`, `adr-017`.

## Evidence

The project-local validator rejects unknown trace IDs and incomplete quality-scenario fields.

## Open questions

- Pending pilot and release evidence must not be promoted to verified without a concrete artifact reference.

## Next review basis

Update when a stable ID is added, removed, superseded or changes trace status.
