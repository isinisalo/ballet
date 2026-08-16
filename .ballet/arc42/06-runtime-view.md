---
id: arc42-section-06
title: Runtime view
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - runtime
arc42Section: 6
---

# 6. Runtime view

## Purpose

Document only runtime scenarios whose risk or complexity materially affects architecture.

## Status

RT-001–RT-003 are implemented platform behavior. RT-004 is configured project behavior pending its first scheduled execution. RT-005 is intentionally human-authorized.

| ID | Trigger and interaction | Building blocks | Result and evidence |
| --- | --- | --- | --- |
| RT-001 | Operator starts a Root Run. BB-003 validates resources; BB-004 snapshots reachable Loops and creates an isolated worktree; BB-006 executes Nodes; BB-005 commits outcomes and State revisions. | BB-003, BB-004, BB-005, BB-006, BB-007 | Active checkout unchanged; immutable snapshot and final commit/worktree evidence. |
| RT-002 | Validation returns `FAIL/LOCAL_RETRY`. Runtime persists feedback, increments the bounded attempt and returns to the same Work phase with current State. | BB-005, BB-006 | No user-authored retry edge; attempts and evidence remain append-only. |
| RT-003 | Validation returns `FAIL/ORCHESTRATOR_REPAIR`. Orchestrator receives only source allowlist candidates, resolves one capability target, creates a frame, runs the target in shared State and returns LIFO to the same Validation. | BB-004, BB-005, BB-006, BB-008 | Model never selects continuation; ambiguous capability returns `needs_input`. |
| RT-004 | Monday 09:00 Europe/Helsinki scheduled learning starts from `research-authoritative-change`, reads primary sources, records only material findings and may request a capability repair. | BB-004, BB-005, BB-006, BB-008 | No external write or document churn when no material finding exists. |
| RT-005 | Human explicitly authorizes a bounded release action, after which release-validation may use network-enabled profiles to create/verify external evidence. | BB-004, BB-006, BB-007, BB-008 | Release/deploy/rollback action is traceable to exact authorization; no automatic flow invokes it. |

## Canonical sources

ADR-015 and runtime source own generic control semantics. `.ballet/project.json` owns project-local Loop topology and tasks.

## Relevant decisions

`adr-005`, `adr-006`, `adr-007`, `adr-008`, `adr-011`, `adr-015`.

## Evidence

Runtime, persistence, scheduler, provider and worktree test suites cover implemented scenarios. Scheduled learning and release evidence remain pending actual authorized runs.

## Open questions

- What first material learning finding, if any, exercises RT-004 repair routing?

## Next review basis

Review when a new failure, concurrency, recovery, repair or external-effect scenario becomes architecturally significant.
