---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 36
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` ja `adr-034` ovat aktiivinen hyväksytty arkkitehtuuri. Canonical implementation käyttää Environment -> State -> Action -domainia, Validation-led-runtimea, Feedback/Critic/Refinement v1 -governancea, immutable continuationia ja Product Snapshotia.

Versiomatriisi on Project Config v20, Root Snapshot v13, Task Envelope / role outcome v10, prompt composition v11, ExecutionSpec v12 ja SQLite v16. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-29 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed before final documentation gate |
| Canonical responsive UI component suites | passed before final browser gate |
| Full docs/design/removal/release/install/startup gates | passed locally; 27 files/254 tests, 219-file removal gate, packaged smoke and healthy local service |
| External writes | not authorized and not performed |

Initiative: [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md). Seuraava yksi evidence-toimi on erikseen valtuutettu real-provider Environment occurrence ja sen Product Snapshot/continuation-review; scope change tai external write vaatii ihmisen uuden päätöksen.
