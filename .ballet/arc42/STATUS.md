---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 46
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `adr-038` tekee Statesta hyväksytyn Use Case -closuren ainoan omistajan ja jakaa Validation/Work-valinnat project-owned resource compositioniin. `adr-040` omistaa kaksi kiinteää read-only Codex governance-agenttia, Codex-only daemonin, model/reasoning-only Action bindingin ja Refinementin developer-instructions-rajan. `goal-023` / `adr-035` säilyttävät minimal Feedback-, Refinement- ja Run Evidence -mallit. `goal-024` / `adr-037` omistavat checkout-local CLI-workerin. `adr-036` omistaa Loop Engineeringin authoring-projektiot.

Versiomatriisi on Project Config v23, Root Snapshot v18, Task Envelope / role outcome v11, prompt composition v14, ExecutionSpec v16 ja SQLite v21; Feedback/Critic/Refinement ja Codex Agent ovat v2, Action execution binding v3 ja Run Evidence v1. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-30 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 38 files / 313 tests including Action regressions, fixed TOML/hash/symlink/rollback boundaries, removed routes and immutable continuation |
| Canonical responsive UI | passed at 1440×900 and 390×844; three columns stack profile → editor → guide, page overflow 0, narrow controls >=40 px, fixed Agent routes and no lifecycle/Preview commands |
| Canonical default project/resources/docs | implemented; v23 default has 13 approved Use Cases, 5 States, 14 Actions and exactly 2 Codex Agent TOMLs |
| Final cross-layer conformance | passed; strict v23/v18/v11/v14/v16/v21/v2/v3, full test/lint/build/arc42/cutover/design/diff gates green; lint has 3 warnings and 0 errors |
| Local package/startup | passed; incompatible daemon config archived recoverably; release SHA-256 `c33d20979f4432725b6652523cdfd9b184b8632a1651a45305fa81fe1011361d`; fresh SQLite v21, server and one Codex provider ready |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is historical for its paired execution portion. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut and its evidence. No live provider occurrence, merge, push, release publication, deploy or external write is claimed.
