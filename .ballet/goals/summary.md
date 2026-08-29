---
id: ballet-goals-summary
title: Ballet project direction summary
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-29'
version: 21
tags: [summary, goals, environment]
---

# Ballet project direction summary

> Ballet turns human-approved Use Cases and decision context into an ordered Environment in which Validation controls bounded Work and immutable runtime evidence explains every effect.

## Active goals

- `goal-002`: project truth is portable and version-controlled; runtime truth is machine-local.
- `goal-005`: every repository effect stays in a safe managed worktree and never implies merge, push, release or deploy.
- `goal-006`: status, blockers, approvals and evidence remain durable, factual and restart-safe.
- `goal-007`: canonical workspaces are accessible and responsive at desktop and narrow viewports.
- `goal-009`: Goals and Use Cases trace through decisions and architecture to executable evidence.
- `goal-022`: Environment → State → Action and Validation-first execution are the active orchestration model.

## Active contract

The strict matrix is Project Config v20, Root Snapshot v13, Task Envelope/role outcome v10, prompt composition v11, ExecutionSpec v12 and SQLite v16, with Feedback, Critic and Refinement v1. `adr-034` owns deterministic order, the Validation-led loop, human approvals, exact Refinement apply, immutable continuation and Product Snapshot semantics.

The repository default demonstrates thirteen approved Use Cases, five ordered States, fourteen bounded Actions, four network-off Codex profiles, lean role instructions and explicitly selected reusable Skills. The compact fixture proves the same platform boundary with unrelated IDs.

## Decision history

Superseded goals, ADRs and initiatives remain Git audit history. Their statuses do not make them active execution or UI contracts. There is one canonical config, database schema, API inventory and route set; no migration, compatibility reader, route alias or dual write exists.

## Human authority

Use Case, Critic and Refinement approvals require explicit human commands bound to current revision and hash. Provider roles have approval policy `never`. External writes, merge, push, release publication and deploy remain outside ordinary Environment authority.

## Canonical reading order

1. [ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [goal-022](goal-022-validation-led-environment-orchestration.md)
3. [ADR-034](../adr/adr-034-validation-led-environment-state-action-orchestration.md)
4. [arc42 index](../arc42/README.md) and [traceability](../arc42/TRACEABILITY.md)
5. [Environment orchestration target contract](../arc42/initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md)
6. [Editable canonical flow](../../ballet.drawio)
