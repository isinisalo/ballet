---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 30
tags: [arc42, building-blocks]
arc42Section: 5
---

# 5. Rakennusosanäkymä

| ID | Rakennusosa | Vastuu | Lähdeankkuri |
| --- | --- | --- | --- |
| BB-015 | Environment orchestration system | strict schemas, project closure, immutable run, Validation-led loop, governance, API/SSE and factual UI | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**` |
| BB-016 | Markdown Agent daemon orchestration | Markdown workbench, deterministic Loop Engineering State/Action canvas and Action flow, Agent definitions/bindings, paired daemon/control plane, Run Evidence and resource-only governance on preserved Environment runtime | same canonical layers after strict v21/v17 cut |
| BB-017 | Checkout-local daemon execution | server-owned SQLite/worktrees/finalization/evidence plus singleton local daemon readiness, polling, fenced CLI execution and local diagnostics | `LocalDaemonStore`, `LocalDaemonOrchestrationProvider`, `backend/daemon/**`, `/api/runtimes/local` |

BB-015 jakautuu seuraaviin selkeisiin rajoihin:

- Shared contracts: schema, versiot, route inventory ja pure status/order -säännöt.
- Project services: config ja Markdown-resource closure.
- Runtime: planner, prompt composition, queue, provider dispatch ja continuation seed.
- Persistence: SQLite v18 schema/stores ja transaction coordinatorit.
- Governance: Feedback, Critic schedule/proposals, human decisions ja Refinement apply.
- HTTP/SSE: loopback security, request validation, mutation commands ja invalidation eventit.
- UI: pure projection -moduulien omistama Loop Engineering State/Action canvas ja Action flow, Markdown project workspaces, Agents, Runtimes, Run Gate, Feedback, Critic, Refinement ja Run Evidence.
- Generic execution infrastructure: checkout-local daemon, Agent bindings, provider adapters, server-owned worktrees and lease/fencing lifecycle.

Riippuvuussuunta on UI/HTTP -> application/runtime -> domain contracts; adapterit ja persistence toteuttavat sisäiset portit. Project-local workflow-data ei kuulu platform-koodiin.
