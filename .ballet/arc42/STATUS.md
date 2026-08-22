---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 22
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta runtime-lokeja, ticket-sisältöä tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-015` ovat accepted.
- `goal-016`, `adr-026` ja `QS-021` ovat draft SSP/SMDP policy -ehdotuksia. Ne eivät muuta active strict-v14-runtimea ilman project owner -päätöstä ja erillistä implementation authorityä.
- `adr-023` omistaa nykyisen strict-v14 Graph/GraphNode/JobNode-domainin, scoped agent routingin ja bounded Repair Noden. `adr-025` omistaa Job Node -authoringin industrial flow -projektion; Graph/Graph Node -avaruuscanvasit ja runtime pysyvät ennallaan.
- Nykyinen hard cut on Project Config v14, Graph Node Module v4, Root Snapshot v7, Task Envelope/Outcome v7, composition v8, ExecutionSpec v9 ja SQLite v10. Compatibility-lukijoita, reittialiaksia, dual-writeä tai runtime-migraatiota ei ole.
- Oletusprojekti sisältää viisi GraphNodea ja 17 aggregate JobNodea, joilla jokaisella on erillinen Work- ja Validation-lapsi. Viiden Graph Noden nimet ja arc42-/release-menettely ovat project-local-dataa.
- Globaali ja viisi paikallista orchestratoria käyttävät explicit Luna/medium/network-off-profiilia; globaalilla ja jokaisella Graph Nodella on explicit Sol/medium/network-off Repair Node. Platform ei hardkoodaa malleja eikä tee fallbackia.
- Julkiset Run-rajat ovat Graph Run ja GraphNode Run. Standalone JobNode Run ja schedule on poistettu. GraphNode Run käyttää Graph-tasoa vain repair-eskalaatioon.
- Canonical authoring-reitit ovat `/automation/graph`, `/automation/graph/nodes/:graphNodeId` ja `/automation/graph/nodes/:graphNodeId/jobs/:jobNodeId`; Run-reitit ovat `/run/graphs/:graphId` ja `/run/graph-nodes/:graphNodeId`.
- Kaikki kolme canvasia käyttävät suojattua 24 px gridia ja samoja tokeneita. Graph/Graph Node käyttävät planet/multi-ring/spoke-kieltä; Job Node käyttää deterministic industrial flow'ta, jossa vain Work/Validation ovat valittavia ja Next job on disabled ghost.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat edelleen täsmällisen ihmisvaltuutuksen.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | `goal-015` / `adr-023` määrittää strict-v14 domain/runtime-rajan ja `adr-025` Job industrial flow -projektion. State-, snapshot-, worktree-, tracker/outbox-, ihmisvaltuutus- ja same-Validation repair-return -invariantit säilyvät. |
| Toteutettu fakta | Shared/domain/config/module-versiot, GraphRoutingEngine ja SQLite v10, Graph/GraphNode Run services, 14 v4-pakettia, kolme canonical routea sekä uusi pure Job flow -projektio löytyvät työpuusta. |
| Paikallinen evidenssi | Aiempi TGNE-EVID-001–005 säilyy Graph/Graph Node -baseline-evidenssinä. ADR-025:n unit/component/integration-, full gate-, desktop/narrow-browser- ja installed-app-evidenssi on passed ja indeksoitu `job-node-industrial-flow-canvas`-initiativeen. |
| Avoin riski | Uuden Job-flow'n ihmisvisual verdict ja ensimmäinen tuotantokaltainen Luna/Sol-pilotti puuttuvat. Ne eivät valtuuta releasea tai external writea. |
| Draft architecture | `stochastic-policy-orchestration` määrittelee Capability Graph / Decision Model / Policy Projection / Execution Graph -rajan, bounded Decision Staten, GraphNode Optionin, hard `A(s)`:n, explicit priors/costit, proper-policy value iterationin ja decision/observation-evidenssin. Implementationia ei ole. |
| Draft architecture evidence | SPO-EVID-ARCH-001/002: arc42 validation, coupling/diff audit ja required build/install/restart/status passed; TEST-021 implementation/pilot evidence on edelleen pending. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet [TRACEABILITYssa](TRACEABILITY.md), State-raja [STATE-CONTRACTissa](STATE-CONTRACT.md), active UI-baseline [job-node-industrial-flow-canvas](initiatives/job-node-industrial-flow-canvas/BRIEF.md)-initiativessa ja draft policy design [stochastic-policy-orchestration](initiatives/stochastic-policy-orchestration/BRIEF.md)-initiativessa.

## Relevantit päätökset

`goal-015`, `adr-011`, `adr-015`, `adr-016`, `adr-023` ja `adr-025`; draft `goal-016` / `adr-026`.

## Evidenssi

- `.ballet/project.json` on strict v14 ja määrittää viisi GraphNodea, 17 JobNodea, scoped candidate-säännöt sekä explicit Luna/Sol-mappingit.
- `.ballet/graph-node-library/**` sisältää 14 strict-v4-pakettia.
- `TEST-019` / `EVID-019` omistaa domain/runtime/module/conformance-evidenssin.
- `TEST-020` / `EVID-020` omistaa canonical route-, scope-, a11y-, layout-, browser- ja visual-evidenssin.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.
- `TEST-021` / `EVID-021` on draft policy-ketju; implementation- ja pilot-evidenssi puuttuvat.

## Avoimet kysymykset

- Hyväksyykö projektin omistaja desktop- ja narrow-selainevidenssin Graph/Graph Node -avaruusteeman sekä Job industrial flow'n kompaktiuden ja ymmärrettävyyden?
- Millainen success/failure/repair-jakauma ensimmäisessä tuotantokaltaisessa Graph Runissa todentaa Luna-routerin ja Sol-repairin käytännön fitnessin?
- Pinned tracker/provider live-smoke raportoidaan erikseen eikä hermetic testi korvaa sitä.
- Hyväksyykö project owner explicit `agent_v1 | ssp_v1` -strategiarajan, proper-policy + infinite failure/blocked -semantiikan, ehdotetut fixed-point/solver-rajat ja v15/v8/v11 strict cutin?

## Nykyinen handoff

- Initiative: `stochastic-policy-orchestration`.
- Status: `draft / needs_input`; architecture inspection ja implementation-ready design ovat valmiit, mutta Goal/ADR/QS ja SPO-OQ-001–004 odottavat project owner -päätöstä.
- Muuttunut stable chain: `goal-016`, `REQ-016`, `QS-021`, `adr-026`, `CON-012`, `BB-011`, `RT-016`, `RISK-018`, `TEST-021`, `EVID-021`.
- Seuraava yksi hyväksytty toimi: project owner reviewaa draftin ja hyväksyy/hylkää strategy-, proper-policy-, solver-bound- ja strict version cut -päätökset.
- Stop condition: runtime/UI/schema-implementation tai deploy/release/merge/push vaatii erillisen täsmällisen valtuutuksen.

## Seuraava katselmointiperuste

Päivitä final gatejen, conformance Validationin, projektin omistajan visual review'n tai uuden hyväksytyn Goal/ADR-muutoksen jälkeen.
