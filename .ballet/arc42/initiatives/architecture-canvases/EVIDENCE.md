---
id: arc42-initiative-architecture-canvases-evidence
title: Architecture canvases initiative evidence
status: draft
createdAt: '2026-08-17'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - initiative
  - evidence
  - canvas
---

# Architecture canvases — EVIDENCE

## Tarkoitus ja tila

Tämä indeksi kokoaa kolmen canvasin sisältö-, linkki- ja conformance-evidenssin. Initiative ja tiedosto pysyvät `draft`-tilassa ihmisarvioon asti; yksittäinen tulos merkitään vain todellisen tarkistuksen perusteella.

## Evidenssirekisteri

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| CANVAS-EVID-001 | ACPT-CANVAS-001–003 | Virallisten canvasien elementit ja lisenssi verrattiin nimettyihin lähdesivuihin: Tech Stack 12, Communication 9 ja Inception 8 elementtiä. | Kolme ulkoista lähde-URL:ia; ASM-CANVAS-001 | passed | 2026-08-17 / official canvas pages | Ulkoisen sivun myöhempi muutos ei päivity paikalliseen snapshotiin automaattisesti. |
| CANVAS-EVID-002 | ACPT-CANVAS-001 | Tech Stack Canvasin 12 headingia, package/release-versiot, sizing, source-ankkurit, trust boundaryt ja explicit gaps tarkistettiin. | `ballet-tech-stack-canvas`; `package.json`; `.github/workflows/release.yml`; BB/RT/DEP/QS-lähteet | passed | 2026-08-17 / repository inspection + field check | Canvas on johdettu snapshot, ei dependency inventoryn korvaaja; tuotantokapasiteettia ei väitetä. |
| CANVAS-EVID-003 | ACPT-CANVAS-002–003 | Communication Canvasin 9 ja Inception Canvasin 8 headingia tarkistettiin; Inceptionissa on kolme quality goal -riviä ja HYP-AIC-001–006 erotettu päätöksistä. | `ballet-architecture-communication-canvas`, `ballet-architecture-inception-canvas` | passed | 2026-08-17 / repository inspection + field check | Hyöty-, business-case- ja usability-hypoteeseilla ei vielä ole käyttäjäevidenssiä. |
| CANVAS-EVID-004 | ACPT-CANVAS-004 | Seitsemän uutta frontmatter-ID:tä ovat uniikkeja ja `draft`; indeksilinkit, johdettu ownership, päivitystriggerit ja persistent handoff ovat läsnä. | `arc42-index`, `arc42-project-status`, `architecture-canvases` | passed | 2026-08-17 / arc42 validator + local link check | Ihmishyväksyntä puuttuu tarkoituksella; nykyiset stable architecture ID:t eivät muuttuneet. |
| CANVAS-EVID-005 | ACPT-CANVAS-005, QS-005 | `npm run validate:arc42` → `arc42 validation passed: 12 sections, 44 unique document IDs, 8 Loops, 35 Loop Edges.` | Koko arc42-/project-local-korpus | passed | 2026-08-17 / local command | Tarkistus todentaa repository-sopimuksen, ei canvasien liiketoimintahyötyä. |
| CANVAS-EVID-006 | ACPT-CANVAS-001–005 | Kohdennettu tarkistus löysi 12 + 9 + 8 official headingia; kaikkien 9 muuttuneen Markdown-tiedoston paikalliset linkit ratkesivat; nimetyt source-ankkurit löytyivät; suojattujen Goal/ADR/config/design/runtime-polkujen diffi oli tyhjä. | Kolme canvasia; muuttuneet index/status/initiative-polut; suojatut repository-polut | passed | 2026-08-17 / `rg`, Node link check, `git diff --name-only` | External HTTP-linkkien myöhempää saatavuutta ei valvota paikallisesti. |
| CANVAS-EVID-007 | ACPT-CANVAS-005 | `git diff --check` päättyi exit-koodilla 0 ilman outputia. | Koko worktree diff | passed | 2026-08-17 / local command | Ei semanttinen prose-arvio. |
| CANVAS-EVID-008 | ACPT-CANVAS-001–005, QS-005 | Bounded conformance review vertasi BRIEFiä, PLANia, canvaseja, index/status-diffiä ja accepted arc42/ADR/CON/BB/RT/DEP/QS-lähteitä. Uutta päätöstä, runtime-sopimusta tai project-tason riskiä ei löytynyt. | `arc42-initiative-architecture-canvases-review`; FIND-CANVAS-001–002 | passed | 2026-08-17 / local conformance review | Verdict on tekninen `conformant with notes`; vain projektin omistaja voi hyväksyä sisällön. |
| CANVAS-EVID-009 | ACPT-CANVAS-006 | Projektin omistajan review totesi, etteivät v1:n proosapainotteiset Markdown-dokumentit näyttäneet korteilta tai toimineet nopeana visuaalisena yhteenvetona. | Kolmen canvasin v1; DEC-CANVAS-002; FIND-CANVAS-003 | failed | 2026-08-17 / explicit human feedback + 3 reference images | Historiallinen epäonnistuminen säilyy näkyvänä; nykyinen v2 korjaa esitystavan. |
| CANVAS-EVID-010 | ACPT-CANVAS-001–003, ACPT-CANVAS-006 | Jokaisen canvasin ensimmäinen Mermaid-lohko renderöitiin Mermaid CLI 11.12.0:lla väliaikaiseksi SVG:ksi. Kaikki kolme komentoa päättyivät exit-koodilla 0. | `ballet-tech-stack-canvas` v2, `ballet-architecture-communication-canvas` v2, `ballet-architecture-inception-canvas` v2 | passed | 2026-08-17 / local `npx @mermaid-js/mermaid-cli@11.12.0` | Renderer-baseline on Mermaid 11.12.0; SVG:t sijaitsevat vain `/tmp`-hakemistossa eikä niitä commitoida. |
| CANVAS-EVID-011 | ACPT-CANVAS-006, QS-013 | Kolme browser-renderöityä PNG-preview'ta tarkastettiin: kortit ovat erillisiä, ruudukot 3 × 4 / 3 × 3 / painotettu 3-palstainen, sans-serif-typografia näkyy ja otsikot sekä ydinsisältö eivät leikkaannu. Värit käyttävät `DESIGN.md`:n dark surface-, secondary-, primary-, tertiary- ja error-tokenperheitä. | Kolmen canvasin Mermaid `block` -diagrammit; väliaikaiset PNG:t `/tmp/ballet-canvases.*` | passed | 2026-08-17 / Mermaid browser render + visual inspection | Markdown-hostin on tuettava Mermaid `block` -diagrammeja; tekstiosiot ovat fallback. Kuvien käytettävyys oikeilla käyttäjillä jää HYP-CANVAS-001:n alle. |
| CANVAS-EVID-012 | ACPT-CANVAS-001–006, QS-005, QS-013 | Visual repair -conformance review vertasi jokaisen kortin tiivistystä sen alla olevaan Markdowniin sekä accepted Goal/QS/ADR/CON/BB/RT/DEP/RISK-lähteisiin. “Canonical UI skaalautuvat” -yliväite korjattiin ennen verdicttiä lähteen mukaiseen tulkintariskin vähenemiseen; lopullisessa diffissä ei ole päätös-, runtime- tai riskidriftiä. | Kolme canvasia v2; `arc42-initiative-architecture-canvases-review`; FIND-CANVAS-003 | passed | 2026-08-17 / bounded local conformance review | Korttien scanability on tarkastettu renderistä, mutta projektin omistajan uusi ihmisarvio puuttuu. |

## Muuttuneet polut

- `.ballet/arc42/canvases/TECH-STACK-CANVAS.md`
- `.ballet/arc42/canvases/ARCHITECTURE-COMMUNICATION-CANVAS.md`
- `.ballet/arc42/canvases/ARCHITECTURE-INCEPTION-CANVAS.md`
- `.ballet/arc42/README.md`
- `.ballet/arc42/STATUS.md`
- `.ballet/arc42/initiatives/architecture-canvases/BRIEF.md`
- `.ballet/arc42/initiatives/architecture-canvases/PLAN.md`
- `.ballet/arc42/initiatives/architecture-canvases/EVIDENCE.md`
- `.ballet/arc42/initiatives/architecture-canvases/REVIEW.md`

`git status --short` raportoi vain yllä olevat kaksi tracked-muutosta ja kaksi uutta arc42-hakemistoa. `.ballet/goals/**`, `.ballet/adr/**`, `.ballet/project.json`, `DESIGN.md`, `backend/`, `frontend/` ja `shared/` ovat muuttumattomia.

## Kanoniset lähteet

Komennot, repository diff, viralliset canvas-sivut ja nykyiset Goal/ADR/arc42/source-polut. Full command output ei kuulu tähän tiedostoon; tulos, rajaus ja olennainen havainto kuuluvat.

## Avoimet kysymykset

- OQ-CANVAS-001:n ihmisarvio puuttuu.
- HYP-CANVAS-001:n perehdytys-/kommunikaatiohyötyä ei mitata tässä dokumenttitoteutuksessa.

## Seuraava katselmointiperuste

Ready for renewed human REVIEW: v2:n paikalliset acceptance-tarkistukset läpäisevät. Historiallinen CANVAS-EVID-009 säilyy `failed`-tilassa eikä sitä peitetä; CANVAS-EVID-010–012 todentavat korjauksen teknisen renderöityvyyden, visuaalisen perustason ja card-to-canon-conformancen. OQ-CANVAS-001 ja HYP-CANVAS-001 pysyvät avoimina, koska tekninen conformance ei ole sisältöhyväksyntä tai hyötymittaus.
