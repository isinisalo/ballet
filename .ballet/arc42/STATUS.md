---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 43
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `goal-023` / `adr-035` säilyttävät Markdown Agents-, minimal Feedback-, resource-only Refinement- ja Run Evidence -mallit. `goal-024` / `adr-037` supersedoivat Computer/pairing/remote-daemon-osat yhdellä checkout-local CLI-workerilla. `adr-036` omistaa Loop Engineeringin authoring-projektiot.

Versiomatriisi on Project Config v21, Root Snapshot v15, Task Envelope / role outcome v11, prompt composition v12, ExecutionSpec v14 ja SQLite v18; Feedback/Critic/Refinement ja Agent/daemon binding ovat v2, Run Evidence v1. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-29 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 38 files / 299 tests including local daemon config/auth, atomic claim/lease/fencing, concurrent status writes, current-PID readiness, provider-default normalization, restart, worktrees, approvals and security boundaries |
| Canonical responsive UI | passed; Agent and singleton Runtimes inspected at 1440×900 and 390×844, page overflow 0, Computer controls 0, provider controls visible and narrow core buttons 44 px |
| Canonical default project/resources/docs/diagram | passed locally; 13 approved Use Cases, 5 States, 14 Actions, 4 Markdown Agents and complete resource/hash/trace validation |
| Final cross-layer conformance | accepted; strict v21/v15/v11/v12/v14/v18/v2 contract, 544-file strict-cut gate, 0 dependency vulnerabilities and all repository gates green; lint has 3 complexity warnings and 0 errors |
| Local package/startup | passed; `make latest`, v17/control-plane archival, packaged fresh-state SQLite v18, server and daemon launchd health, wrong-token HTTP 401 and 8-second daemon recovery with stable PID |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is historical for its paired execution portion. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut and its evidence. No live provider occurrence, merge, push, release publication, deploy or external write is claimed.
