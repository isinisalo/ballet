---
id: arc42-index
title: Balletin arc42-arkkitehtuuri-indeksi
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 9
tags:
  - arc42
  - architecture
  - index
---

# Balletin arc42-arkkitehtuuri-indeksi

## Tarkoitus

Tämä hakemisto on Balletin kanoninen, versionhallittu arkkitehtuurin tietorakenne virallisen [arc42:n 12 osion](https://docs.arc42.org/home/) mukaisesti. Ballet Loops toteuttavat jatkuvan menetelmän, joka ylläpitää rakennetta evidenssin ja ihmisarvion kautta.

## Tila

12-osioinen baseline on hyväksytty. Project config, shared contract, snapshot, Loop module -materialisointi ja cross-Loop-dispatch käyttävät strict v11 -Graph/capability-sopimusta. Authoring-UI:n Context/numeric-route hard cut on toteutettu: käytössä ovat Graph Engineering ja selected-Loop-only Loop Engineering. Graphin Orchestrator-control-node ja canonical policy/Run-evidenssiin sidottu edge-presentation on toteutettu; ihmisacceptance on vielä pending. Aktiivinen korpus on suomenkielinen; lähdekoodin nimet, stable ID:t ja vakiintuneet Ballet-termit säilyvät englanniksi. Todennettu tieto sijoitetaan sen omistavaan osioon, ja puuttuva tieto kirjataan avoimeksi kysymykseksi eikä keksitä.

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

Uusi initiative alkaa TEMPLATE-hakemiston kopiosta omilla vakailla ID:illä ja `draft`-tilassa. Oletus-flow on clarify → structures → concepts → communicate → implementation → evaluate. Validation voi pyytää allowlistattua capability repairia, mutta epäselvä WHAT/WHY, prioriteetti tai merkittävä valinta pysähtyy `needs_input`-tilaan. Release/deploy/merge/push eivät sisälly oletus-flow’hun.

## Relevantit päätökset

`goal-009`, `goal-010`, `goal-011`, `goal-012`, `adr-011`, `adr-013`, `adr-014`, `adr-015`, `adr-016`, `adr-017` ja `adr-018`.

## Evidenssi

Virallinen [arc42-dokumentaatio](https://docs.arc42.org/home/) määrittää osiorakenteen. Paikallinen `npm run validate:arc42` tarkistaa dokumentti- ja trace-sopimuksen sekä project-local-menetelmäresurssit.

## Avoimet kysymykset

- Initiative-kohtaista kysymystä ei nosteta project-tasolle, ellei vaikutus ylitä initiative-rajaa.

## Seuraava katselmointiperuste

Katselmoi indeksi, kun kanoninen polku, section ownership, initiative template tai persistent handoff muuttuu.
