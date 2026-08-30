---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 47
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `adr-041` poistaa State-owned Use Case -closuren, tekee project-kontekstista instruction/Skill-ohjatun ja antaa ID-only sortable-listoille ainoan ordering-editorivastuun. `adr-040` omistaa kaksi kiinteää read-only Codex governance-agenttia, Codex-only daemonin, model/reasoning-only Action bindingin ja Refinementin developer-instructions-rajan. `goal-023` / `adr-035` säilyttävät minimal Feedback-, Refinement- ja Run Evidence -mallit. `goal-024` / `adr-037` omistavat checkout-local CLI-workerin. `adr-036` omistaa Loop Engineeringin authoring-projektiot.

Versiomatriisi on Project Config v24, Root Snapshot v19, Task Envelope / role outcome v11, prompt composition v15, ExecutionSpec v17 ja SQLite v22; Feedback/Critic/Refinement ja Codex Agent ovat v2, Action execution binding v3 ja Run Evidence v1. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-30 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 38 files / 312 tests including legacy `useCaseIds` rejection, draft Use Case Run planning, snapshot/task-context absence, ordering, Action regressions and immutable continuation |
| Canonical responsive UI | passed at 1440×900 and 390×844; State/Action ID-only sortable lists, compact `maxRetries`, page overflow 0, keyboard ordering and no direct order/priority controls |
| Canonical default project/resources/docs | implemented; v24 default has 13 project-local approved Use Cases, 5 States, 14 Actions and exactly 2 Codex Agent TOMLs |
| Final cross-layer conformance | passed; strict v24/v19/v11/v15/v17/v22/v2/v3, full test/lint/build/arc42/cutover/design/diff gates green; lint has 2 pre-existing complexity warnings and 0 errors |
| Local package/startup | passed; release SHA-256 `e53dccc0661995305a2d58a308cab87b91fc469d3c8c24605ffe417486fb3271`; fresh SQLite v22, server and one Codex provider ready |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is historical for its paired execution portion. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut and its evidence. No live provider occurrence, merge, push, release publication, deploy or external write is claimed.
