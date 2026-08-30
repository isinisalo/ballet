---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 33
tags: [arc42, building-blocks]
arc42Section: 5
---

# 5. Rakennusosanäkymä

| ID | Rakennusosa | Vastuu | Lähdeankkuri |
| --- | --- | --- | --- |
| BB-015 | Environment orchestration system | strict schemas, instruction-directed project context, immutable run, Validation-led loop, governance, API/SSE and factual UI | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**` |
| BB-016 | Project composition and governance Agents | Action-owned Agent/Skill composition, two fixed governance TOMLs, deterministic Loop Engineering projections and Run Evidence | canonical layers after strict v25/v23 cut |
| BB-017 | Checkout-local Codex execution | server-owned SQLite/worktrees/finalization/evidence, Action role model/reasoning selections, singleton Codex readiness, polling and fenced CLI execution | `LocalDaemonStore`, `LocalDaemonOrchestrationProvider`, `backend/daemon/**`, `/api/runtimes/local` |
| BB-018 | Action Agent composition | strict Action-ID/role TOML inventory, atomic Project Config + pair lifecycle, immutable Agent/hash/Skill snapshot and Action-owned editor | `CodexAgentRepository`, `ActionAgentMutationService`, `EnvironmentRunPlanner`, `ActionWorkspace` |

BB-015 jakautuu seuraaviin selkeisiin rajoihin:

- Shared contracts: schema, versiot, route inventory ja pure status/order -säännöt.
- Project services: config, project-local Markdown documents and Action Agent/Skill composition.
- Runtime: planner, prompt composition, queue, provider dispatch ja continuation seed.
- Persistence: SQLite v23 schema/stores ja transaction coordinatorit; no Action execution binding table.
- Governance: Feedback, Critic schedule/proposals, human decisions ja Refinement apply.
- HTTP/SSE: loopback security, request validation, mutation commands ja invalidation eventit.
- UI: pure projection -moduulien omistama Loop Engineering State/Action canvas ja Action flow, Markdown project workspaces, Agents, Runtimes, Run Gate, Feedback, Critic, Refinement ja Run Evidence.
- Generic execution infrastructure: checkout-local Codex daemon, strict Action/governance Agent repository, server-owned worktrees and lease/fencing lifecycle.

Riippuvuussuunta on UI/HTTP -> application/runtime -> domain contracts; adapterit ja persistence toteuttavat sisäiset portit. Project-local workflow-data ei kuulu platform-koodiin.
