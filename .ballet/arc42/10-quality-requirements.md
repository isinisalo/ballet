---
id: arc42-section-10
title: Quality requirements
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - quality
  - scenarios
arc42Section: 10
---

# 10. Quality requirements

## Purpose

Define specific, measurable scenarios used for architecture design and evaluation.

## Status

Priorities and criteria are accepted by the authorization for `goal-009`; runtime effectiveness evidence marked pending requires a real run.

<!-- quality-scenarios:start -->
| ID | Source | Stimulus | Environment | Affected artifact | Expected response | Measurable response criterion | Priority | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QS-001 | goal-001, goal-007 | Operator starts and uses Ballet from a committed checkout. | Supported macOS host, local browser. | BB-001, BB-002, DEP-001 | Serve only the checkout-local command center and expose exact operational state. | API binds only to loopback; a second checkout has a distinct service identity and state; automated lifecycle/API checks pass. | 1 | EVID-001 | verified |
| QS-002 | goal-002, goal-003 | A Root Run is requested with changed or invalid project resources. | Preflight before any provider task. | BB-003, BB-004 | Snapshot one deterministic valid composition or fail closed. | Invalid/duplicate/missing profile, instruction or skill produces at least one exact issue and queues 0 provider tasks; same sources produce the same resource hashes. | 1 | EVID-002 | verified |
| QS-003 | goal-004, goal-006 | Validation requests an external repair. | Active Root Run with one or more repair candidates. | BB-004, BB-005, RT-003 | Route only by capability within the source allowlist and return to the same Validation. | Target is allowlisted; continuation is runtime-owned; ambiguous evidence returns `needs_input`; repair depth/attempt/transition limits are never exceeded. | 1 | EVID-003 | verified |
| QS-004 | goal-005 | A normal architecture or implementation Node executes. | Root Run worktree, no explicit research/release need. | BB-004, BB-006, DEP-002 | Keep network disabled and writes inside the Run worktree. | 100% of non-research/non-release configured Nodes use a network-off profile; permission-policy and worktree tests pass. | 1 | EVID-004 | verified |
| QS-005 | goal-009 | A project architecture or method artifact changes. | Repository validation before handoff. | BB-003, BB-008 | Preserve one resolvable source of truth with stable IDs. | `npm run validate:arc42` reports 0 missing required docs, duplicate IDs, broken local links, unresolved traces or resource references. | 1 | EVID-005 | verified |
| QS-006 | goal-009 | An initiative reaches architecture evaluation. | Evaluate Loop after bounded implementation. | BB-004, BB-008, RT-003 | Compare implementation against measurable QS and record evidence, risks and drift. | Every initiative REVIEW traces each in-scope priority-1 QS to a test/monitor and evidence status; unresolved gaps are findings or repair requests, never silently accepted. | 1 | EVID-006 | pending pilot |
| QS-007 | goal-005, goal-008, goal-009 | A release, deploy or rollback is requested. | Release-validation Loop with network capability. | BB-006, BB-007, RT-005, DEP-003 | Stop for exact human authorization before each unapproved external action. | 0 external write commands occur before recorded authorization; merge and push remain absent from automatic behavior; all attempted commands are listed in evidence. | 1 | EVID-007 | policy verified; execution pending |
| QS-008 | goal-009 | Scheduled learning finds a possible technology or method improvement. | Monday research run with primary-source network access. | BB-006, BB-008, RT-004 | Record only material evidence and route change through the correct approval boundary. | Every retained finding has source, impact, QS/RISK/ADR/BB reference and expected metric; no material finding yields 0 semantic document changes. | 2 | EVID-008 | pending pilot |
<!-- quality-scenarios:end -->

## Canonical sources

Goals own quality intent. This section owns measurable scenarios; TRACEABILITY owns their relationship to implementation and evidence.

## Relevant decisions

`adr-006`, `adr-008`, `adr-011`, `adr-015`.

## Evidence

Evidence IDs resolve in TRACEABILITY. Pending evidence is not treated as success.

## Open questions

- Pilot-specific performance or usability thresholds require human acceptance in the initiative BRIEF before becoming in-scope scenarios.

## Next review basis

Review when a Goal changes, a scenario cannot be measured, or evaluation shows the criterion does not distinguish success from failure.
