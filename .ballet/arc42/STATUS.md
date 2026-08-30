---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 50
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `adr-041` poistaa State-owned Use Case -closuren, tekee project-kontekstista instruction/Skill-ohjatun ja antaa ID-only sortable-listoille ainoan ordering-editorivastuun. `adr-042` tekee jokaisen Actionin Validation- ja Work-TOMLista instruction/model/reasoning-totuuden ja poistaa machine-local Action bindingin. `adr-040` säilyttää kaksi kiinteää read-only governance-agenttia ja Codex-only daemonin. `goal-023` / `adr-035` säilyttävät minimal Feedback-, Refinement- ja Run Evidence -mallit. `goal-024` / `adr-037` omistavat checkout-local CLI-workerin. `adr-043` omistaa Loop Engineeringin tiiviin authoring-projektion ja säilyttää Action-flow-rajat.

Versiomatriisi on Project Config v25, Root Snapshot v20, Task Envelope / role outcome v11, prompt composition v16, ExecutionSpec v18 ja SQLite v23; Feedback/Critic/Refinement ovat v2, Codex Agent v3 ja Run Evidence v1. Action execution bindingia ei ole. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-30 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 38 files / 313 tests including exact Action Agent inventory/schema, atomic pair rollback/lock, immutable snapshot, permissions, refinement and UI regressions |
| Canonical responsive UI | passed at 1440×900 and 390×844; Action Agent names/settings/Skills visible, page overflow 0, console errors 0 and narrow dialog keyboard focus verified |
| Canonical default project/resources/docs | implemented; v25 default has 13 project-local approved Use Cases, 5 States, 21 Actions, 42 unique Action Agent TOMLs, shared Skills and 2 governance Agent TOMLs |
| Final cross-layer conformance | passed; strict v25/v20/v11/v16/v18/v23/v2/v3, full test/lint/build/arc42/cutover/design/diff gates green; lint has 2 pre-existing complexity warnings and 0 errors |
| Local package/startup | passed; release SHA-256 `5ddcca88f0a2ea2638fe8e2bf96c2bd76bb2e88014b78edaf8e61b073d3c8f46`; fresh SQLite v23, no Action binding table, server and Codex daemon/provider ready |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is historical for its paired execution portion. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut and its evidence. No live provider occurrence, merge, push, release publication, deploy or external write is claimed.
