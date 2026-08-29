---
id: mado-target-contract-001
title: Markdown Agent daemon orchestration target contract
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [arc42, initiative, contract]
---

# TARGET CONTRACT

## Truth ownership

- Project truth: Markdown Goals, ADRs, Constraints, Use Cases, Instructions, Agent definitions and Project Config v21 Environment.
- Machine-local truth: paired devices, daemon token/keychain state, CLI backend capabilities and Agent execution bindings.
- Runtime truth: immutable Root Snapshot v14, statuses/events, Feedback/Critic/Refinement v2, approvals and Run Evidence v1.

## Invariants

1. Environment → State → Action ordering, Validation precheck/postwork restrictions, Work subordination, `1 + maxRetries`, atomic blocked Feedback and immutable continuation remain those of ADR-034.
2. Action role composition references an enabled Agent and may add only explicit action-local instructions/skills. Tool policy is server-derived by role.
3. All Agent bindings in one Run resolve to one online device, one exact checkout and one config hash before dispatch.
4. Claims are leased and fenced; terminal outcomes and root finalization are idempotent.
5. Human Feedback request has only `category` and `comment`. Trusted server context owns actor and provenance.
6. Refinement allowlist is exactly `.ballet/agents/**`, `.ballet/instructions/**`, `.agents/skills/**`; proposal is read-only and apply requires exact human approval plus unchanged preimages.
7. Run Evidence is a terminal immutable projection, not a Product entity or independent truth store.

## Canonical UI and API

UI routes are `/automation/loops`, `/agents`, `/skills`, `/runtimes`, `/project/goals`, `/project/adrs`, `/project/constraints`, `/project/use-cases`, `/project/instructions`, `/run`, `/feedback`, `/reviews/critic` and `/reviews/refinement`.

Typed APIs include project Markdown documents, Agent definitions, `GET/PUT /api/agents/:id/execution`, `/api/runtimes/**`, `/api/daemon/**`, strict `POST /api/feedback`, `POST /api/feedback/:id/refinement`, run lifecycle/details/SSE and review decision commands. There is no products API.

## Security and permission matrix

| Actor | Read | Write |
| --- | --- | --- |
| human | all local authoring/runtime projections | Markdown, bindings, schedules, approvals, run commands, Feedback |
| daemon | claimed immutable task/snapshot and bounded resources | heartbeat, lease, logs, terminal callback |
| Validation | snapshot, evidence, read-only roots | typed validation outcome only |
| Work | snapshot, delegated prompt, managed worktree | managed worktree under role policy |
| Critic | latest successful Run Evidence and approved context | proposal only |
| Refinement | Feedback and allowed resources | proposal only; platform apply after human approval |

## Strict target versions

| Contract | Version |
| --- | ---: |
| Project Config | 21 |
| Root Snapshot | 14 |
| Task Envelope / role outcome | 11 |
| prompt composition | 12 |
| ExecutionSpec | 13 |
| SQLite | 17 |
| Feedback / Critic / Refinement | 2 |
| Agent / daemon binding / Run Evidence | 1 |

V20/v16 and Product/ExecutionProfile routes, tables, readers and types are removed. No migration, compatibility reader, alias or dual-write is allowed.
