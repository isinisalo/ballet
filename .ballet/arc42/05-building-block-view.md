---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 31
tags: [arc42, building-blocks]
arc42Section: 5
---

# 5. Rakennusosanäkymä

| ID | Rakennusosa | Vastuu | Lähdeankkuri |
| --- | --- | --- | --- |
| BB-015 | Environment orchestration system | strict schemas, project closure, immutable run, Validation-led loop, governance, API/SSE and factual UI | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**` |
| BB-016 | Project composition and governance Agents | Action-owned instruction/Skill composition, Markdown Critic/Refinement Agents, deterministic Loop Engineering projections and Run Evidence | canonical layers after strict v22/v19 cut |
| BB-017 | Checkout-local daemon execution | server-owned SQLite/worktrees/finalization/evidence, Action-role and governance Agent bindings, singleton readiness, polling and fenced CLI execution | `LocalDaemonStore`, `LocalDaemonOrchestrationProvider`, `backend/daemon/**`, `/api/runtimes/local` |

BB-015 jakautuu seuraaviin selkeisiin rajoihin:

- Shared contracts: schema, versiot, route inventory ja pure status/order -säännöt.
- Project services: config ja Markdown-resource closure.
- Runtime: planner, prompt composition, queue, provider dispatch ja continuation seed.
- Persistence: SQLite v19 schema/stores ja transaction coordinatorit.
- Governance: Feedback, Critic schedule/proposals, human decisions ja Refinement apply.
- HTTP/SSE: loopback security, request validation, mutation commands ja invalidation eventit.
- UI: pure projection -moduulien omistama Loop Engineering State/Action canvas ja Action flow, Markdown project workspaces, Agents, Runtimes, Run Gate, Feedback, Critic, Refinement ja Run Evidence.
- Generic execution infrastructure: checkout-local daemon, Action-role and governance Agent bindings, provider adapters, server-owned worktrees and lease/fencing lifecycle.

Riippuvuussuunta on UI/HTTP -> application/runtime -> domain contracts; adapterit ja persistence toteuttavat sisäiset portit. Project-local workflow-data ei kuulu platform-koodiin.
