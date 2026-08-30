---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 45
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `adr-038` tekee Statesta hyväksytyn Use Case -closuren ainoan omistajan ja jakaa Validation/Work-valinnat project-owned resource compositioniin. `adr-039` sitoo Validationin ja subordinate Workin samaan Action-provideriin ja policyyn sekä säilyttää model/reasoning-valinnat roolikohtaisina. `goal-023` / `adr-035` säilyttävät Critic/Refinement Markdown Agents-, minimal Feedback-, resource-only Refinement- ja Run Evidence -mallit. `goal-024` / `adr-037` omistavat checkout-local CLI-workerin. `adr-036` omistaa Loop Engineeringin authoring-projektiot.

Versiomatriisi on Project Config v22, Root Snapshot v17, Task Envelope / role outcome v11, prompt composition v13, ExecutionSpec v15 ja SQLite v20; Feedback/Critic/Refinement, Action execution binding ja governance Agent binding ovat v2 ja Run Evidence v1. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-30 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 38 files / 311 tests including atomic Action binding upsert/cleanup, canonical/removed API routes, both role capability mismatches, zero-dispatch preflight and immutable continuation evidence |
| Canonical responsive UI | passed at 1440×900 and 390×844; one provider/policy/save, two same-provider model/reasoning selections, nested Skills, missing-binding readiness and keyboard focus visible; page overflow 0 and console errors 0 |
| Canonical default project/resources/docs | passed; v22 default has 13 approved Use Cases, 5 States, 14 Actions and 2 governance Markdown Agents; Action Use Case/Agent fields absent |
| Final cross-layer conformance | passed; strict v22/v17/v11/v13/v15/v20/v2, 545-file cutover, arc42/design/diff/build gates green; lint has 4 warnings and 0 errors |
| Local package/startup | passed; SQLite v19 archived recoverably at `.git/ballet/archive/action-shared-provider-v19-20260830T1029/state.sqlite`; `make latest` archive SHA-256 `5f71001d7c53cdfac22e03e692816eb79a89c0c4978afb1a936ad5e80cfcdc30`; fresh SQLite v20, server and both providers ready |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is historical for its paired execution portion. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut and its evidence. No live provider occurrence, merge, push, release publication, deploy or external write is claimed.
