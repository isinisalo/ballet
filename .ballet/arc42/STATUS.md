---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 21
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

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet [TRACEABILITYssa](TRACEABILITY.md), State-raja [STATE-CONTRACTissa](STATE-CONTRACT.md) ja aktiivisen UI-muutoksen yksityiskohdat [job-node-industrial-flow-canvas](initiatives/job-node-industrial-flow-canvas/BRIEF.md)-initiativessa. `DESIGN.md` omistaa visuaalisen sopimuksen ja `adr-025` Job-projektion päätöksen.

## Relevantit päätökset

`goal-015`, `adr-011`, `adr-015`, `adr-016`, `adr-023` ja `adr-025`.

## Evidenssi

- `.ballet/project.json` on strict v14 ja määrittää viisi GraphNodea, 17 JobNodea, scoped candidate-säännöt sekä explicit Luna/Sol-mappingit.
- `.ballet/graph-node-library/**` sisältää 14 strict-v4-pakettia.
- `TEST-019` / `EVID-019` omistaa domain/runtime/module/conformance-evidenssin.
- `TEST-020` / `EVID-020` omistaa canonical route-, scope-, a11y-, layout-, browser- ja visual-evidenssin.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- Hyväksyykö projektin omistaja desktop- ja narrow-selainevidenssin Graph/Graph Node -avaruusteeman sekä Job industrial flow'n kompaktiuden ja ymmärrettävyyden?
- Millainen success/failure/repair-jakauma ensimmäisessä tuotantokaltaisessa Graph Runissa todentaa Luna-routerin ja Sol-repairin käytännön fitnessin?
- Pinned tracker/provider live-smoke raportoidaan erikseen eikä hermetic testi korvaa sitä.

## Nykyinen handoff

- Initiative: `job-node-industrial-flow-canvas`.
- Status: `draft`; `goal-015`, `adr-023` ja `adr-025` ovat accepted. Implementation/full gate/browser/installed-app-evidenssi ja conformance-review ovat passed; human visual verdict on pending.
- Muuttunut stable evidence chain: ADR-025, BB-001, CON-005/011, QS-020, TEST-020 ja EVID-020.
- Seuraava hyväksytty toimi: viimeistele initiative-evidenssi ja pyydä projektin omistajan visual verdict tallennetuille desktop/narrow-kuville.
- Stop condition: deploy, release, rollback, merge tai push vaatii oman täsmällisen ihmisvaltuutuksensa.

## Seuraava katselmointiperuste

Päivitä final gatejen, conformance Validationin, projektin omistajan visual review'n tai uuden hyväksytyn Goal/ADR-muutoksen jälkeen.
