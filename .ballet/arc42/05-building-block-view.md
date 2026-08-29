---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 27
tags: [arc42, building-blocks]
arc42Section: 5
---

# 5. Rakennusosanäkymä

| ID | Rakennusosa | Vastuu | Lähdeankkuri |
| --- | --- | --- | --- |
| BB-015 | Environment orchestration system | strict schemas, project closure, immutable run, Validation-led loop, governance, API/SSE and factual UI | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**` |
| BB-016 | Markdown Agent daemon orchestration | Markdown workbench, Agent definitions/bindings, paired daemon/control plane, Run Evidence and resource-only governance on preserved Environment runtime | same canonical layers after strict v21/v17 cut |

BB-015 jakautuu seuraaviin selkeisiin rajoihin:

- Shared contracts: schema, versiot, route inventory ja pure status/order -säännöt.
- Project services: config ja Markdown-resource closure.
- Runtime: planner, prompt composition, queue, provider dispatch ja continuation seed.
- Persistence: SQLite v16 schema/stores ja transaction coordinatorit.
- Governance: Feedback, Critic schedule/proposals, human decisions ja Refinement apply.
- HTTP/SSE: loopback security, request validation, mutation commands ja invalidation eventit.
- UI: Configure, Run Gate, Feedback, Critic, Refinement ja Product Snapshot.
- Generic execution infrastructure: provider adapters, ExecutionProfiles, worktrees and local runtime lifecycle.

Riippuvuussuunta on UI/HTTP -> application/runtime -> domain contracts; adapterit ja persistence toteuttavat sisäiset portit. Project-local workflow-data ei kuulu platform-koodiin.
