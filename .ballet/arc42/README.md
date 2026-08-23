---
id: arc42-index
title: Balletin arc42-arkkitehtuuri-indeksi
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 19
tags:
  - arc42
  - architecture
  - index
---

# Balletin arc42-arkkitehtuuri-indeksi

## Tarkoitus

Tämä hakemisto on Balletin kanoninen, versionhallittu arkkitehtuurin tietorakenne virallisen [arc42:n 12 osion](https://docs.arc42.org/home/) mukaisesti. Balletin project-local GraphNodet toteuttavat jatkuvan menetelmän, joka ylläpitää rakennetta evidenssin ja ihmisarvion kautta.

## Tila

12-osioinen baseline on hyväksytty. Nykyinen Portti A -implementation käyttää strict-v16 Graph/GraphNode/JobNode/strategy-sopimusta, explicit scoped `agent_v1 | ssp_v2` -strategioita ilman fallbackia, Graph Node Module v5:tä, Root Snapshot v9:ää, Task Envelope/outcome v8:aa, composition v9:ää, ExecutionSpec v10:tä ja SQLite schema v12:ta. `goal-017` / `adr-028` ja `goal-018` / `adr-029` ovat review-tilassa. Draft `goal-019` / `adr-030` valmistaa calibration/promotion-governancen; Phase 2, calibrated pilot ja Portti B odottavat omia ihmisporttejaan. Aktiivinen korpus on suomenkielinen; lähdekoodin nimet, stable ID:t ja vakiintuneet Ballet-termit säilyvät englanniksi.

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
- [Job Node industrial flow canvas initiative](initiatives/job-node-industrial-flow-canvas/BRIEF.md): accepted `adr-025` ja review-tilaisen `adr-027`:n bounded UI-, a11y-, desktop/narrow- ja conformance-evidenssi ilman runtime-sopimusmuutosta.
- [Stochastic Policy Orchestration initiative](initiatives/stochastic-policy-orchestration/BRIEF.md): accepted `goal-016` / `adr-026` finite SSP/SMDP Graph-policy; core implementation evidence on kerätty ja projection/pilot/conformance ovat review-rajalla.
- [Outcome-aware hierarchical policy initiative](initiatives/outcome-aware-hierarchical-policy/BRIEF.md): review-tilainen `goal-017` / `adr-028` scoped outcome-aware `ssp_v2`, proper-policy-, projection-, observation- ja pilotointiketju.
- [Capability-first authoring initiative](initiatives/capability-first-authoring/BRIEF.md): review-tilainen `goal-018` / `adr-029` upper-level card authoring ja Run-policy/evidence-projektio ADR-025/027:n Job-flow'ta muuttamatta.
- [Governed policy calibration and promotion initiative](initiatives/governed-policy-calibration-and-promotion/BRIEF.md): draft `goal-019` / `adr-030` observation-cost-, offline candidate-, evaluation-, shadow- ja human activation/rollback -ketju ilman toteutusvaltuutusta.

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

Uusi initiative alkaa TEMPLATE-hakemiston kopiosta omilla vakailla ID:illä ja `draft`-tilassa. Active Graph ja GraphNode runtime käyttävät kumpikin eksplisiittistä `agent_v1`- tai `ssp_v2`-strategiaa ilman runtime-fallbackia. `ssp_v2` ratkaisee GraphNode-optionin tai JobNode-actionin scopekohtaisesta proper policysta; Work→Validation, bounded retry ja scoped Repair ovat Job Noden kiinteitä invariantteja. Epäselvä WHAT/WHY, prioriteetti, projisoimaton state tai merkittävä valinta pysähtyy `needs_input`-tilaan.

## Relevantit päätökset

`goal-009`–`goal-019`, `adr-011`, `adr-013`–`adr-016` ja `adr-023`–`adr-030`.

## Evidenssi

Virallinen [arc42-dokumentaatio](https://docs.arc42.org/home/) määrittää osiorakenteen. Paikallinen `npm run validate:arc42` tarkistaa dokumentti- ja trace-sopimuksen, strict-v16 scoped strategy -konfiguraation sekä project-local-menetelmäresurssit.

## Avoimet kysymykset

- Initiative-kohtaista kysymystä ei nosteta project-tasolle, ellei vaikutus ylitä initiative-rajaa.

## Seuraava katselmointiperuste

Katselmoi indeksi, kun kanoninen polku, section ownership, initiative template tai persistent handoff muuttuu.
