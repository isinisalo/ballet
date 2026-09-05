---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-05'
version: 53
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `adr-041` poistaa State-owned Use Case -closuren, tekee project-kontekstista instruction/Skill-ohjatun ja antaa ID-only sortable-listoille ainoan ordering-editorivastuun. `adr-042` tekee jokaisen Actionin Validation- ja Work-TOMLista instruction/model/reasoning-totuuden ja poistaa machine-local Action bindingin. `adr-040` säilyttää kaksi kiinteää read-only governance-agenttia ja Codex-only daemonin. `goal-023` / `adr-035` säilyttävät minimal Feedback-, Refinement- ja Run Evidence -mallit, ja `adr-047` tekee kuuden jaetun project Markdown -näkymän workbenchistä editor-onlyn. `goal-024` / `adr-037` omistavat checkout-local CLI-workerin. `adr-045` omistaa Loop Engineeringin väljän kolmitasoisen Dagre-authoring-puun, URL-owned Agent/create-alinäkymät, concise labelit, lightweight floating-edget ja planeetta/Action-flow strict removalin.

Versiomatriisi on Project Config v25, Root Snapshot v20, Task Envelope / role outcome v11, prompt composition v16, ExecutionSpec v18 ja SQLite v23; Feedback/Critic/Refinement ovat v2, Codex Agent v3 ja Run Evidence v1. Action execution bindingia ei ole. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-09-05 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | implementation scope passed; checkout reports 327/328 because the preserved user `.ballet/project.json` State array is `[2,3,4,5,1]`; clean canonical-project suite verifies the product baseline |
| Canonical responsive UI | passed at 1440×900 and 390×844; all three graph ranks visible on desktop, narrow page overflow 0, zoom controls 40×44 px, Agent/create panes verified and console errors/warnings 0/0 |
| Canonical default project/resources/docs | implemented; v25 default has 13 project-local approved Use Cases, 5 States, 21 Actions, 42 unique Action Agent TOMLs, shared Skills and 2 governance Agent TOMLs |
| Final cross-layer conformance | passed for adr-045/QS-033; strict v25/v20/v11/v16/v18/v23/v2/v3, scoped/clean tests, lint/build/arc42/cutover/design/diff gates green; lint has 5 non-blocking complexity warnings and 0 errors |
| Local package/startup | passed; release SHA-256 `a6497ae5ed6d81c44cdf24e3fd3c320645e154efbdf6cb28656b37e5f970c111`; installed server and Codex daemon/provider ready; canonical Agent deep link HTTP 200 |
| Editor-only Markdown workbench | passed canonical: Goals/ADRs/Constraints/Use Cases/Instructions/Skills tests 6/6, full suite 382/382, rendered Preview 0, source editors 2, page overflow 0 at 1440×900 and 390×844, preview source/dependencies 0, lint/build/arc42/cutover/design/diff gates green, packaged service and daemon healthy |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains the runtime baseline. [loop-engineering-three-level-dagre](initiatives/loop-engineering-three-level-dagre/BRIEF.md) records the active UI projection and evidence. [checkout-local-daemon](initiatives/checkout-local-daemon/BRIEF.md) records the active local-only cut. No live provider occurrence, merge, push, release publication or deploy is claimed.
