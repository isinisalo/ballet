---
id: workflow-engineering-brief
title: Workflow Engineering hard cut brief
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-20'
version: 2
tags:
  - arc42
  - initiative
  - workflow-engineering
---

# Workflow Engineering BRIEF

## Initiative

- Initiative ID: `workflow-engineering`
- Owner: project owner
- Status: `draft`
- Goal / requirement: `goal-013` / `REQ-013`
- Quality scenario: `QS-015`
- Decision: `adr-020`, `adr-021`

## Fact

Strict-v11 mallinsi valitun Loopin sisäisen työn composite WorkLoopNodena ja nimellä Loop Engineering. Validationin outcome yhdisti päätöksen ja reititysmoodin, eikä erillinen ValidationNode ollut canvasilla itsenäisesti valittava.

## Decision

Käyttäjä hyväksyi 2026-08-20 strict-v12/v2 hard cutin ja tarkensi samana päivänä canvas-projektiota: Graph Engineering säilyy, selected-Loop-projektio on Workflow Engineering, domain käyttää erillisiä Job/Validation-nodeja sekä Pass/Fail Edgejä, mutta canvas näyttää vain Job-artworkit ja persisted Edget ilman Validation- tai result-nodeja.

## Stakeholders

- Projektin omistaja hyväksyy WHAT/WHY:n, visual QA:n ja ulkoiset kirjoitukset.
- Kehittäjä tarvitsee yhden strict contractin ja tarkan v7-database remediation -rajan.
- Agenttioperaattori tarvitsee rakenteen ja runtime-evidenssin, jotka vastaavat toisiaan ilman väriin tai implisiittiseen modeen tukeutumista.
- Loop Module -käyttäjä tarvitsee v2-paketin, joka materialisoi saman v12-rakenteen deterministisesti.

## Scope

- Project config v12, snapshot v5, module v2, envelope/outcome v5, execution spec v7/composition v6 ja SQLite schema v8.
- Workflow schema, runtime, persistence, recovery, repair continuation, API ja repository-data.
- Graph/Workflow-routing, erilliset Job/Validation-editorit, atomic Job pair authoring ja deterministic accessible canvas, jossa Validation projisoituu Jobin sisään ja Edget käyttävät vain `straight | smoothstep` -geometriaa.
- Project-local instructionit, Loop Library -paketit, testit ja canonical arc42/DESIGN-dokumentaatio.
- `WorkLoopNode`, `WorkNode`, Validation `OK`, mode-valinta, `view=loop` ja `work_loop_node_runs` poistetaan aktiivisista poluista.

## Non-goals

- Graph Engineeringin topology- tai Orchestrator-mallin korvaaminen.
- Staten omistajuuden, repair-framejen LIFO-palautumisen tai project/platform-rajan muuttaminen.
- Automaattinen schema v7 → v8 -tietokantamigraatio.
- Release, deploy, merge tai push.

## Constraints and interfaces

- Kaikki JobNodet ovat saavutettavia startista PassEdgeillä ja vähintään yksi PASS-endpoint on saavutettava.
- Job/Validation-paritus ja Validationin Pass/Fail-kardinaliteetti ovat täsmällisiä.
- Provider ei valitse local retryä, repair targetia tai continuationia.
- Väri ei ole ainoa UI-signaali; Job, Edge ja terminaalinen result-label sisältävät myös ikonin ja tekstin.
- Pre-release hard cut ei säilytä legacy-readeria, route-aliasia tai dual-writeä.

## Quality and acceptance

`QS-015` on prioriteetti 1. Hyväksyminen vaatii `TEST-015`:n schema-, runtime-, Orchestrator-, persistence-, API-, module- ja UI-matriisin, aktiivisen legacy-haun, platform/workflow boundary -haun, kaikki repository-gatet sekä desktop/narrow-ihmisreview'n.

## Assumption and hypothesis

- **WFE-ASSUMPTION-001:** Repositoryn v11-konfiguraatiot ja v1-paketit voidaan muuntaa deterministisesti säilyttämällä composite-ID JobNode-ID:nä ja johtamalla ValidationNode-ID `<job-id>-validation`-muodossa.
- **WFE-HYPOTHESIS-001:** Erillinen domain- ja editorirakenne vähentää eroa authoring-mallin ja runtime-evidenssin välillä ilman Graph-semanttiikan muutosta.
- **WFE-HYPOTHESIS-002:** Yksi Job-artwork per pari vähentää canvasin visuaalista kohinaa ilman Validation-runtime-totuuden tai Edge-semanttiikan menetystä.

## Evidence

Päätöslähteet ovat käyttäjän 2026-08-20 hyväksymä toteutussuunnitelma ja canvas-tarkennus, `goal-013`, `adr-020`, `adr-021` sekä nykyinen source/test-baseline. Toteutusevidenssi indeksoidaan `EVIDENCE.md`:ssä.

## Open questions

- Ihmisreview vahvistaa vielä desktop/narrow-layoutin tulkittavuuden ja sen, että sisäinen Validation sekä terminal PASS/FAIL ymmärretään ilman erillisiä nodeja tai väriin yksin tukeutumista.

## Next review basis

Initiative voidaan hyväksyä vasta, kun kaikki prioriteetti-1 `QS-015` -tekniset gatet ovat passed ja projektin omistaja on arvioinut visual QA:n.
