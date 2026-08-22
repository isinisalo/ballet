---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 19
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
- `adr-023` omistaa nykyisen strict-v14 Graph/GraphNode/JobNode-domainin, scoped agent routingin, bounded Repair Noden ja kolmitasoisen avaruuscanvasin. Se supersedoi ADR-016/018/020/021/022:n Loop-, kaksinäkymä-, Edge-, schedule- ja deterministic RunBook -osuudet muuttamatta historiallisia tiedostoja.
- Nykyinen hard cut on Project Config v14, Graph Node Module v4, Root Snapshot v7, Task Envelope/Outcome v7, composition v8, ExecutionSpec v9 ja SQLite v10. Compatibility-lukijoita, reittialiaksia, dual-writeä tai runtime-migraatiota ei ole.
- Oletusprojekti sisältää viisi GraphNodea ja 17 aggregate JobNodea, joilla jokaisella on erillinen Work- ja Validation-lapsi. Viiden Graph Noden nimet ja arc42-/release-menettely ovat project-local-dataa.
- Globaali ja viisi paikallista orchestratoria käyttävät explicit Luna/medium/network-off-profiilia; globaalilla ja jokaisella Graph Nodella on explicit Sol/medium/network-off Repair Node. Platform ei hardkoodaa malleja eikä tee fallbackia.
- Julkiset Run-rajat ovat Graph Run ja GraphNode Run. Standalone JobNode Run ja schedule on poistettu. GraphNode Run käyttää Graph-tasoa vain repair-eskalaatioon.
- Canonical authoring-reitit ovat `/automation/graph`, `/automation/graph/nodes/:graphNodeId` ja `/automation/graph/nodes/:graphNodeId/jobs/:jobNodeId`; Run-reitit ovat `/run/graphs/:graphId` ja `/run/graph-nodes/:graphNodeId`.
- Kaikki kolme canvasia käyttävät suojattua 24 px avaruusgridia, planet-artworkeja, glow'ta, amber-ID:itä, mint-spokeja ja kirkkaita connection pointteja. Kullakin tasolla näytetään vain sen scope.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat edelleen täsmällisen ihmisvaltuutuksen.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | `goal-015` / `adr-023` määrittää strict-v14 domain-, runtime-, module-, persistence- ja UI-rajan. State-, snapshot-, worktree-, tracker/outbox-, ihmisvaltuutus- ja same-Validation repair-return -invariantit säilyvät. |
| Toteutettu fakta | Shared/domain/config/module-versiot, GraphRoutingEngine ja SQLite v10, Graph/GraphNode Run services, 14 v4-pakettia, kolme canonical canvas-routea sekä Luna/Sol-project data löytyvät työpuusta. |
| Paikallinen evidenssi | `TGNE-EVID-001`–`TGNE-EVID-005`: 40 tiedoston 156 testiä, build, arc42, DESIGN, module, boundary, active-legacy ja diff-portit läpäisevät. Kolme canonical canvasia sekä 1/5/40 GraphNode- ja 1/17/64 JobNode-fixturet on mitattu 1440×900/390×844-koossa; 19 kuvaa on tallennettu initiative-evidenssiin. |
| Avoin riski | Ihmisen desktop/narrow-visual verdict ja ensimmäinen tuotantokaltainen Luna/Sol-pilotti puuttuvat. Ne eivät valtuuta releasea tai external writea. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet [TRACEABILITYssa](TRACEABILITY.md), State-raja [STATE-CONTRACTissa](STATE-CONTRACT.md) ja aktiivisen muutoksen yksityiskohdat [three-level-graph-node-engineering](initiatives/three-level-graph-node-engineering/BRIEF.md)-initiativessa. `DESIGN.md` omistaa visuaalisen sopimuksen ja `adr-023` päätöksen.

## Relevantit päätökset

`goal-015`, `adr-011`, `adr-015`, `adr-016` ja `adr-023`.

## Evidenssi

- `.ballet/project.json` on strict v14 ja määrittää viisi GraphNodea, 17 JobNodea, scoped candidate-säännöt sekä explicit Luna/Sol-mappingit.
- `.ballet/graph-node-library/**` sisältää 14 strict-v4-pakettia.
- `TEST-019` / `EVID-019` omistaa domain/runtime/module/conformance-evidenssin.
- `TEST-020` / `EVID-020` omistaa canonical route-, scope-, a11y-, layout-, browser- ja visual-evidenssin.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- Hyväksyykö projektin omistaja desktop- ja narrow-selainevidenssin avaruusteeman, kompaktiuden ja ymmärrettävyyden?
- Millainen success/failure/repair-jakauma ensimmäisessä tuotantokaltaisessa Graph Runissa todentaa Luna-routerin ja Sol-repairin käytännön fitnessin?
- Pinned tracker/provider live-smoke raportoidaan erikseen eikä hermetic testi korvaa sitä.

## Nykyinen handoff

- Initiative: `three-level-graph-node-engineering`.
- Status: `draft`; `goal-015` ja `adr-023` ovat accepted, toteutus on työpuussa ja technical/browser/conformance-evidenssi läpäisee. Ihmisen visual verdict ja provider-pilotti ovat avoinna.
- Muuttunut stable evidence chain: CON-011, RT-014/015, QS-019/020, TEST-019/020 ja EVID-019/020.
- Seuraava hyväksytty toimi: pyydä projektin omistajan visual verdict tallennetuille kuville ja suunnittele erikseen tuotantokaltainen provider-pilotti.
- Stop condition: deploy, release, rollback, merge tai push vaatii oman täsmällisen ihmisvaltuutuksensa.

## Seuraava katselmointiperuste

Päivitä final gatejen, conformance Validationin, projektin omistajan visual review'n tai uuden hyväksytyn Goal/ADR-muutoksen jälkeen.
