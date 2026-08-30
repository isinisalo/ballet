---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 44
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `adr-038` tekee Statesta hyväksytyn Use Case -closuren ainoan omistajan ja jakaa Validation/Work-valinnat project-owned resource compositioniin sekä machine-local Action-role bindingiin. `goal-023` / `adr-035` säilyttävät Critic/Refinement Markdown Agents-, minimal Feedback-, resource-only Refinement- ja Run Evidence -mallit. `goal-024` / `adr-037` omistavat checkout-local CLI-workerin. `adr-036` omistaa Loop Engineeringin authoring-projektiot.

Versiomatriisi on Project Config v22, Root Snapshot v16, Task Envelope / role outcome v11, prompt composition v13, ExecutionSpec v15 ja SQLite v19; Feedback/Critic/Refinement ovat v2, Action-role binding v1, governance Agent binding v2 ja Run Evidence v1. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-30 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 38 files / 306 tests including Action-role binding upsert/cleanup, API ownership/role validation, capability/policy mismatches, zero-dispatch preflight and immutable continuation evidence |
| Canonical responsive UI | passed at 1440×900 and 390×844; provider→model→reasoning, nested Skills, distinct saves and missing-binding readiness visible; page overflow 0 and console errors 0 |
| Canonical default project/resources/docs | passed; v22 default has 13 approved Use Cases, 5 States, 14 Actions and 2 governance Markdown Agents; Action Use Case/Agent fields absent |
| Final cross-layer conformance | passed; strict v22/v16/v11/v13/v15/v19/v1/v2, 544-file cutover, arc42/design/diff/build gates green; lint has 4 warnings and 0 errors |
| Local package/startup | passed; v18 SQLite archived recoverably, `make latest` archive SHA-256 `36fd6a2551ee2c44f776bbbc0b9dd3a7b79cbeb51e9ca00fc844fe98a7072241`, fresh SQLite v19, server and both providers ready |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is historical for its paired execution portion. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut and its evidence. No live provider occurrence, merge, push, release publication, deploy or external write is claimed.
