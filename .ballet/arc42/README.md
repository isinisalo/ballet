---
id: arc42-index
title: Balletin arc42-arkkitehtuuri-indeksi
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 13
tags:
  - arc42
  - architecture
  - index
---

# Balletin arc42-arkkitehtuuri-indeksi

## Tarkoitus

Tämä hakemisto on Balletin kanoninen, versionhallittu arkkitehtuurin tietorakenne virallisen [arc42:n 12 osion](https://docs.arc42.org/home/) mukaisesti. Balletin project-local GraphNodet toteuttavat jatkuvan menetelmän, joka ylläpitää rakennetta evidenssin ja ihmisarvion kautta.

## Tila

12-osioinen baseline on hyväksytty. Nykyinen hard cut käyttää strict-v14 Graph/GraphNode/JobNode-sopimusta, Graph Node Module v4:ää, Root Snapshot/Task Envelope/outcome v7:ää, composition v8:aa, ExecutionSpec v9:ää ja SQLite schema v10:tä. Repositoryn oletusgraafissa on viisi GraphNodea ja 17 aggregate JobNodea. Scoped Luna-orchestratorit päättävät tasojen välisen reitityksen strict candidate-enumista; scoped Sol Repair Nodet käsittelevät rajatut poikkeukset ennen ihmiseskalaatiota. Graph-, Graph Node- ja Job Node -canvasit käyttävät samaa suojattua avaruusteemaa ja näyttävät vain oman scopensa. `three-level-graph-node-engineering`-initiativen tekninen ja visuaalinen evidenssi indeksoidaan erikseen eikä pending-tulosta käsitellä hyväksyntänä. Aktiivinen korpus on suomenkielinen; lähdekoodin nimet, stable ID:t ja vakiintuneet Ballet-termit säilyvät englanniksi.

## Osiot

1. [Johdanto ja tavoitteet](01-introduction-and-goals.md)
2. [Rajoitteet](02-constraints.md)
3. [Konteksti ja rajaus](03-context-and-scope.md)
4. [Ratkaisustrategia](04-solution-strategy.md)
5. [Rakennusosanäkymä](05-building-block-view.md)
6. [Ajonäkymä](06-runtime-view.md)
7. [Käyttöönottonäkymä](07-deployment-view.md)
8. [Poikkileikkaavat konseptit](08-crosscutting-concepts.md)
9. [Arkkitehtuuripäätökset](09-architecture-decisions.md)
10. [Laatuvaatimukset](10-quality-requirements.md)
11. [Riskit ja tekninen velka](11-risks-and-technical-debt.md)
12. [Sanasto](12-glossary.md)

## Canvasit

- [Tech Stack Canvas](canvases/TECH-STACK-CANVAS.md): 12 Mermaid-kortin pikayhteenveto teknologiapinosta, sizingistä, integraatioista, laadunvarmistuksesta ja tunnetuista stack-aukoista.
- [Architecture Communication Canvas](canvases/ARCHITECTURE-COMMUNICATION-CANVAS.md): yhdeksän Mermaid-kortin yhteenveto arvolupauksesta, sidosryhmistä, toiminnoista, vastuista, päätösten trade-offeista ja riskeistä.
- [Architecture Inception Canvas](canvases/ARCHITECTURE-INCEPTION-CANVAS.md): kahdeksan Mermaid-kortin retrospektiivinen business case, aloitusrajat, top-3-laatu, hypoteesit ja tekniset haasteet.

Canvasit ovat `draft`-tilaisia Markdown + Mermaid -projektioita. Korttiruudukko on pikayhteenveto ja sen alla oleva Markdown jäljitettävä tarkennus. Ne eivät omista WHAT/WHY:tä, hyväksyttyä päätöstä, arkkitehtuuriosion yksityiskohtaa tai toteutuksen totuutta; ristiriidassa kanoninen lähde voittaa.

## Tukilähteet

- [STATUS](STATUS.md): persistent project status ja yksi seuraava handoff.
- [TRACEABILITY](TRACEABILITY.md): Goal/REQ–QS–ratkaisu–testi–evidenssi-suhteet.
- [METHOD-HEALTH](METHOD-HEALTH.md): menetelmän mitatut toimintahavainnot ja muutoshypoteesit.
- [STATE-CONTRACT](STATE-CONTRACT.md): rajattu runtime State; Markdown säilyy pitkäikäisenä totuutena.
- [Migration assessment](migration/ASSESSMENT.md): historiallinen lähtötilan evidenssi, jota ei uudelleenkirjoiteta.
- [Initiative template](initiatives/TEMPLATE/BRIEF.md): uuden rajatun työn rakenne.
- [Comprehensive documentation initiative](initiatives/comprehensive-arc42-documentation/BRIEF.md): tämän suomenkielisen kattavan dokumentaation draft-ketju.
- [Architecture canvases initiative](initiatives/architecture-canvases/BRIEF.md): kolmen canvas-projektion draft BRIEF/PLAN/EVIDENCE/REVIEW-ketju.
- [Graph and Loop Engineering initiative](initiatives/graph-and-loop-engineering/BRIEF.md): accepted v11-päätöksen BRIEF/PLAN/EVIDENCE/REVIEW-ketju; domain/config/snapshot/module/runtime sekä routing/Graph/Loop Engineering -tekninen evidenssi on kerätty, ihmisacceptance on pending.
- [Workflow Engineering initiative](initiatives/workflow-engineering/BRIEF.md): accepted `goal-013` / `adr-020` / `adr-021` -päätösrajan draft BRIEF/PLAN/EVIDENCE/REVIEW-ketju; strict-v12/v2-tekninen evidenssi ja Job-only canvas-korjaus arvioidaan erikseen, final gate ja ihmisacceptance ovat pending.
- [Graph Engineering RunBook initiative](initiatives/graph-engineering-runbook/BRIEF.md): accepted `goal-014` / `adr-022` -rajan strict-v13/V3-, tracker-, viiden Loopin data-, Graph UI- ja conformance-evidenssi.
- [Three-level Graph Node Engineering initiative](initiatives/three-level-graph-node-engineering/BRIEF.md): accepted `goal-015` / `adr-023` -rajan strict-v14/V4/V10-, scoped routing/repair-, kolmen canvasin ja conformance-evidenssi.

## Kanoninen omistajuus

| Lähde | Omistaa | Ei omista |
| --- | --- | --- |
| `.ballet/goals/**` | WHAT/WHY, rajaus ja hyväksymisaie | Arkkitehtuuripäätöksen koko perustelu |
| `.ballet/adr/**` | Hyväksytyt arkkitehtuuripäätökset ja supersession | Runtime-logi tai initiative-evidenssi |
| Osiot 1–12 | Pitkäikäiset arkkitehtuurinäkymät ja selitykset | Goal/ADR-tekstin kopio |
| `canvases/**` | Tiivis teknologia-, kommunikaatio- tai inception-projektio | Uusi WHAT/WHY, päätös tai rinnakkainen arkkitehtuuritotuus |
| `initiatives/<id>/**` | Rajatun muutoksen BRIEF/PLAN/EVIDENCE/REVIEW | Koko projektin rinnakkainen arkkitehtuurikorpus |
| `STATUS` / `TRACEABILITY` / `METHOD-HEALTH` | Persistent handoff, suhteet ja mitattu menetelmätila | Runtime-logidumppi |
| `DESIGN.md` | UI-designjärjestelmä | Runtime-control semantics |
| `.git/ballet` | Machine-local canonical runtime state | Versionhallittu project truth |

## Työskentelysääntö

Uusi initiative alkaa TEMPLATE-hakemiston kopiosta omilla vakailla ID:illä ja `draft`-tilassa. Project-local GraphNodet ja JobNodet toteuttavat repositoryn menetelmän; Graph- ja Graph Node -orchestratorit valitsevat tasojen välisen dispatchin immutable snapshotin strict candidate-enumista. Work→Validation ja bounded retry ovat Job Noden kiinteitä invariantteja. Epäselvä WHAT/WHY, prioriteetti, merkittävä valinta tai viimeisen repair-rajan ylitys pysähtyy `needs_input`-tilaan. Merge/push eivät sisälly oletusflow'hun.

## Relevantit päätökset

`goal-009`–`goal-015`, `adr-011`, `adr-013`–`adr-016` ja `adr-023`.

## Evidenssi

Virallinen [arc42-dokumentaatio](https://docs.arc42.org/home/) määrittää osiorakenteen. Paikallinen `npm run validate:arc42` tarkistaa dokumentti- ja trace-sopimuksen, strict-v14 Graphin sekä project-local-menetelmäresurssit.

## Avoimet kysymykset

- Initiative-kohtaista kysymystä ei nosteta project-tasolle, ellei vaikutus ylitä initiative-rajaa.

## Seuraava katselmointiperuste

Katselmoi indeksi, kun kanoninen polku, section ownership, initiative template tai persistent handoff muuttuu.
