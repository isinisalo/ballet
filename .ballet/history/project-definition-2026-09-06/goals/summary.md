---
id: ballet-goals-summary
title: Ballet project direction summary
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-29'
version: 23
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
- `goal-023`: Markdown is the authoring workbench, Agents are project truth and a paired Computer/CLI binding owns execution readiness.
- `goal-024`: one checkout-local daemon owns provider readiness and CLI processes while the server owns runtime, worktrees, finalization and evidence.

## Active contract

The accepted strict target is Project Config v24, Root Snapshot v19, Task Envelope/role outcome v11, prompt composition v15, ExecutionSpec v17 and SQLite v22, with Feedback, Critic and Refinement v2, Action execution binding v3, Codex Agent v2 and Run Evidence v1. `adr-041` owns instruction-directed project context and sortable ordering, `adr-035` retains Markdown authoring and Run Evidence, and `adr-037` retains the local-only execution boundary.

The repository default demonstrates thirteen approved Use Cases, five ordered States, fourteen bounded Actions, four Markdown Agents, lean role instructions and explicitly selected reusable Skills. The compact fixture proves the same platform boundary with unrelated IDs.

## Decision history

Superseded goals, ADRs and initiatives remain Git audit history. Their statuses do not make them active execution or UI contracts. There is one canonical config, database schema, API inventory and route set; no migration, compatibility reader, route alias or dual write exists.

## Human authority

Use Case, Critic and Refinement approvals require explicit human commands bound to current revision and hash. Provider roles have approval policy `never`. External writes, merge, push, release publication and deploy remain outside ordinary Environment authority.

## Canonical reading order

1. [ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [goal-023](goal-023-markdown-agent-daemon-orchestration.md)
3. [ADR-035](../adr/adr-035-markdown-agents-paired-daemon-and-run-evidence.md)
4. [goal-022](goal-022-validation-led-environment-orchestration.md) and [ADR-034](../adr/adr-034-validation-led-environment-state-action-orchestration.md)
5. [arc42 index](../arc42/README.md) and [traceability](../arc42/TRACEABILITY.md)
6. [Markdown Agent daemon target contract](../arc42/initiatives/markdown-agent-daemon-orchestration/TARGET-CONTRACT.md)
7. [goal-024](goal-024-checkout-local-daemon.md)
8. [ADR-037](../adr/adr-037-checkout-local-daemon.md)
9. [Checkout-local daemon target contract](../arc42/initiatives/checkout-local-daemon/TARGET-CONTRACT.md)
7. [Editable canonical flow](../../ballet.drawio)
