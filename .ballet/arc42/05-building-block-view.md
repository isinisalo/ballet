---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 39
tags: [arc42, building-blocks]
arc42Section: 5
---

# 5. Rakennusosanäkymä

| ID | Rakennusosa | Vastuu | Lähdeankkuri |
| --- | --- | --- | --- |
| BB-015 | Environment orchestration system | strict schemas, instruction-directed project context, immutable run, Validation-led loop, governance, API/SSE and factual UI | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**` |
| BB-016 | Project composition and governance Agents | Action-owned Agent/Skill composition, two fixed governance TOMLs, deterministic React Flow + Dagre Loop Engineering projection and Run Evidence | canonical layers after strict v26/v24 cut |
| BB-017 | Checkout-local Codex execution | server-owned SQLite/worktrees/finalization/evidence, Action role model/reasoning selections, singleton Codex readiness, polling and fenced CLI execution | `LocalDaemonStore`, `LocalDaemonOrchestrationProvider`, `backend/daemon/**`, `/api/runtimes/local` |
| BB-018 | Action Agent composition | strict Action-ID/role TOML inventory, atomic Project Config + pair lifecycle, immutable Agent/hash/Skill snapshot and Action-owned editor | `CodexAgentRepository`, `ActionAgentMutationService`, `EnvironmentRunPlanner`, `ActionWorkspace` |
| BB-019 | Event Storming process map | Shared semantic v2 concepts/processes, independent layout v1, whole-story links, offline bounded context and separate optimistic queues | `shared/orchestration/eventStorming.ts`, `EventStormingService`, `EventStormingContextService`, `frontend/src/orchestration/event-storming/**` |
| BB-020 | Project definition | Overview, Story v2 approval, ADR Markdown and existing Event Storming; no duplicate config content | `UserStoryService`, `ProjectDocumentRepository`, `ProjectMarkdownWorkspace`, `UserStoryApproval` |

BB-015 jakautuu seuraaviin selkeisiin rajoihin:

- Shared contracts: schema, versiot, route inventory ja pure status/order -säännöt.
- Project services: config, project-local Markdown documents and Action Agent/Skill composition. Repositories share `atomicWrite` after their own path/hash/lock checks.
- Fact: `UserStoryService` owns strict repository-only Story v2 CRUD and trusted-human approval. `userStoryMarkdown` stores structured YAML and one Markdown body; `userStoryApproval` hashes every semantic field and CommonMark structure. Byte hashes guard all writes and approvals; reads invalidate stale semantic approval. `/api/user-stories/:id/approve` accepts only expected file/semantic hashes, never actor metadata. The existing active-Run authoring lock remains; stories never enter a Run gate, snapshot or prompt injection.
- Fact: `ProjectDocumentRepository` owns `.ballet/overview.md` and ADR files directly. `/api/overview` GET/PUT and `/api/adrs` CRUD use atomic optimistic Markdown writes. `ProjectMarkdownWorkspace` reuses `MarkdownWorkbench` and `useMarkdownDraft`. Project Config has no direction or document payload.
- Runtime: planner, prompt composition, queue, provider dispatch ja continuation seed.
- Persistence: SQLite v24 schema/stores ja transaction coordinatorit; no Action execution binding table.
- Governance: Feedback, Critic schedule/proposals, human decisions ja Refinement apply.
- HTTP/SSE: route adapters validate requests; `AuthoringController` owns project commands, `ApiController` runtime/governance commands and invalidations; `RunQueries` and `ReviewQueries` own read projections. `RefinementPreimages` verifies exact immutable diff bytes.
- UI: `useMarkdownDraft` owns source and baseline hash together; `useActionDraft` owns Action/Agent saves; `invalidationStream` shares one reconnecting SSE connection and route-scoped hooks load visible data. Graph workspaces load lazily. Pure projection -moduulin ja Dagren omistama Loop Engineering State/Action/Agents-rakenne, React Flow -renderer, URL-owned settings/create-pane, Markdown project workspaces, Agents, Runtimes, Run Gate, Feedback, Critic, Refinement ja Run Evidence.
- Generic execution infrastructure: checkout-local Codex daemon, strict Action/governance Agent repository, server-owned worktrees and lease/fencing lifecycle.

Riippuvuussuunta on UI/HTTP -> application/runtime -> domain contracts; adapterit ja persistence toteuttavat sisäiset portit. Project-local workflow-data ei kuulu platform-koodiin.
