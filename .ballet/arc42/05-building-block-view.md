---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-05'
version: 36
tags: [arc42, building-blocks]
arc42Section: 5
---

# 5. Rakennusosanäkymä

| ID | Rakennusosa | Vastuu | Lähdeankkuri |
| --- | --- | --- | --- |
| BB-015 | Environment orchestration system | strict schemas, instruction-directed project context, immutable run, Validation-led loop, governance, API/SSE and factual UI | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**` |
| BB-016 | Project composition and governance Agents | Action-owned Agent/Skill composition, two fixed governance TOMLs, deterministic React Flow + Dagre Loop Engineering projection and Run Evidence | canonical layers after strict v25/v23 cut |
| BB-017 | Checkout-local Codex execution | server-owned SQLite/worktrees/finalization/evidence, Action role model/reasoning selections, singleton Codex readiness, polling and fenced CLI execution | `LocalDaemonStore`, `LocalDaemonOrchestrationProvider`, `backend/daemon/**`, `/api/runtimes/local` |
| BB-018 | Action Agent composition | strict Action-ID/role TOML inventory, atomic Project Config + pair lifecycle, immutable Agent/hash/Skill snapshot and Action-owned editor | `CodexAgentRepository`, `ActionAgentMutationService`, `EnvironmentRunPlanner`, `ActionWorkspace` |

| BB-019 | Event Storming workshop | Shared v1 notes, board-local geometry, file-only optimistic model repository, serial autosave and visual authoring | `shared/orchestration/eventStorming.ts`, `EventStormingService`, `frontend/src/orchestration/event-storming/**` |

BB-015 jakautuu seuraaviin selkeisiin rajoihin:

- Shared contracts: schema, versiot, route inventory ja pure status/order -säännöt.
- Project services: config, project-local Markdown documents and Action Agent/Skill composition.
- Fact: `UserStoryService` owns repository-first User Story v1 CRUD over `ProjectDocumentRepository`. `shared/orchestration/userStories.ts` owns the strict Role/Goal/Benefit and ordered Given/When/Then contract; Markdown frontmatter is the only persisted content. `/api/user-stories` exposes the collection and document commands, and the URL-owned card workspace renders them. User Stories are independent of Project Config and SQLite and never participate in Root Snapshots or Run gates. Atomic file replacement, optimistic hashes and the existing active-Run authoring lock bound mutations; Markdown notes survive edits.
- Runtime: planner, prompt composition, queue, provider dispatch ja continuation seed.
- Persistence: SQLite v23 schema/stores ja transaction coordinatorit; no Action execution binding table.
- Governance: Feedback, Critic schedule/proposals, human decisions ja Refinement apply.
- HTTP/SSE: loopback security, request validation, mutation commands ja invalidation eventit.
- UI: pure projection -moduulin ja Dagren omistama Loop Engineering State/Action/Agents-rakenne, React Flow -renderer, URL-owned settings/create-pane, Markdown project workspaces, Agents, Runtimes, Run Gate, Feedback, Critic, Refinement ja Run Evidence.
- Generic execution infrastructure: checkout-local Codex daemon, strict Action/governance Agent repository, server-owned worktrees and lease/fencing lifecycle.

Riippuvuussuunta on UI/HTTP -> application/runtime -> domain contracts; adapterit ja persistence toteuttavat sisäiset portit. Project-local workflow-data ei kuulu platform-koodiin.
