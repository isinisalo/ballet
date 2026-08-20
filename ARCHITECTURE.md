---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 11
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin ja jatkuvaan kehitysmenetelmään. Lue ensin nykytila ja tarvittava arc42-osio; älä päättele project workflow’ta runtime-koodista tai kopioi machine-local-tilaa dokumentaatioksi.

## Tila

- `goal-001`–`goal-013` omistavat hyväksytyn WHAT/WHY:n.
- Virallisen [arc42-rakenteen 12 osiota](https://docs.arc42.org/home/) ovat kanonisesti `.ballet/arc42/`-hakemistossa.
- `goal-009` ja `adr-011` hyväksyvät jatkuvan Ballet Methodin; `adr-019` supersedoi vain kiinteän 6+1-topologian ja materialisoi architecture-significant vastuut yhden done-conditionin capability-Loopeiksi.
- `goal-010` ja `adr-016` hyväksyvät yhden Loopin authoring package -rajan: paketti materialisoidaan project-local-runtime-resursseiksi eikä ole live runtime dependency.
- Nykyinen project config -baseline on strict v12 ja Loop Module -baseline v2. Root Execution Snapshot on v5, Task Envelope ja node outcome v5, execution spec v7 / composition v6 sekä SQLite schema v8. `graph.loopEdges` omistaa peer-reitit, ja jokainen Loop ilmoittaa namespaced `accepts`/`provides`-capabilityt.
- Nykyinen project-local-baseline sisältää 11 Loopia, 20 JobNodea, 20 yksinomaisesti paritettua ValidationNodea ja 62 graph-edgeä. Rakennesuunnittelu on erotettu solution strategy-, Building Block View- ja runtime/deployment-Loopeiksi; crosscutting concepts ja architecture decision ovat erilliset Loopit.
- Cross-Loop-runtime toteuttaa `goal-012` / `adr-018`:n Orchestrator-owned flow/repair-dispatchin immutable snapshotista. `goal-013` / `adr-020` korvaa vain valitun Loopin sisäisen compositen strict-v12 `ProjectWorkflow`-mallilla: erilliset Job/Validation-domainnodet, Pass/Fail Edget, rajattu kiinteä retry ja Workflow PASS/FAIL -tulokset. `adr-021` rajaa vain canvas-projektion yhteen Job-artworkiin per pari, persisted straight/smart-smoothstep Edgeihin ja nodeista vapaisiin terminaalituloksiin. Authoring-UI käyttää vain URL-ohjattuja Graph Engineering- ja selected-Loop-only Workflow Engineering -näkymiä. Graph Engineering säilyttää yhden Orchestrator-control-noden ja yhden LoopNoden per `ProjectLoop`.
- Root Runin Mission / All Loops / live inspector on canonical snapshot/persistence -projektio; se ei muodosta uutta control statea.
- `comprehensive-arc42-documentation` on draft-initiative, kunnes projektin omistaja arvioi sen EVIDENCE/REVIEW-ketjun.

## Kanoniset lähteet

- [arc42-indeksi](.ballet/arc42/README.md)
- [pitkäikäinen status ja handoff](.ballet/arc42/STATUS.md)
- [traceability](.ballet/arc42/TRACEABILITY.md)
- [method health](.ballet/arc42/METHOD-HEALTH.md)
- [State-sopimus](.ballet/arc42/STATE-CONTRACT.md)
- [Goal-yhteenveto](.ballet/goals/summary.md)
- [arkkitehtuuripäätösindeksi](.ballet/arc42/09-architecture-decisions.md)
- [UI-designjärjestelmä](DESIGN.md)

## Omistajuus ja lukujärjestys

1. Goalit: WHAT/WHY, rajaus ja hyväksymisaie.
2. ADR:t: tärkeät, riskialttiit tai vaikeasti peruttavat päätökset.
3. arc42-osiot 1–12: konteksti, rakenteet, runtime, deployment, konseptit, laatu, riskit ja sanasto.
4. Initiative BRIEF/PLAN/EVIDENCE/REVIEW: yhden rajatun muutoksen sopimus ja näyttö.
5. `DESIGN.md`: UI-tokenit ja visuaaliset periaatteet.
6. `.ballet/project.json`, instructionit ja skillit: runtimeen materialisoitu project-local-menetelmä.
7. `.git/ballet`: machine-local canonical runtime state, ei pitkäikäinen arkkitehtuuriteksti.

## Relevantit päätökset

`adr-011` määrittää source-of-truth- ja menetelmärajan. `adr-015` säilyttää historiallisena State-, repair- ja continuation-invariantit. `adr-016` supersedoi vain ADR-014:n no-package-V1-rajan. `adr-017` säilyttää historiallisen v10-authoring-baselinen. `adr-018` omistaa Graph Engineeringin ja Orchestrator-ohjatun cross-Loop-flow'n. `adr-019` säilyttää project/platform-vastuurajan. `adr-020` korvaa vain ADR-015:n composite WorkLoopNode -mallin ja ADR-018:n Loop Engineering -nimen/reitin Workflow Engineeringillä ja erillisillä Job/Validation-domainnodeilla. `adr-021` supersedoi vain ADR-020:n canvas-projektion; domain, runtime ja erilliset editorit säilyvät.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumentit, traceabilityn, project-resurssit ja strict-v12 Workflow/Graph/capability-sopimuksen. Runtime-, module-, provider-, recovery- ja UI-testit tarkistavat toteutuksen. Aktiivisen Root Runin execution truth tulee immutable snapshotista ja canonical SQLite -faktoista; pitkäikäinen hyväksymisevidenssi indeksoidaan initiative-EVIDENCEen.

## Avoimet kysymykset

- Mikä rajattu initiative toimii ensimmäisenä yhden vastuun Ballet Method -topologian end-to-end-pilottina?
- Mitkä lähtöarvot ensimmäinen pilotti tuottaa METHOD-HEALTH-mittareille?
- Hyväksyykö projektin omistaja `graph-and-loop-engineering`-initiativen koko `EVID-014`-ketjun paikallisen implementation-evidenssin ja erillisen ihmisreview'n jälkeen?
- Hyväksyykö projektin omistaja `workflow-engineering`-initiativen `EVID-015`-ketjun teknisten gatejen ja desktop/narrow-ihmisreview'n jälkeen?
- Hyväksyykö projektin omistaja `comprehensive-arc42-documentation`-draftin lopputarkistuksen jälkeen?

## Seuraava katselmointiperuste

Katselmoi aloituspiste, kun kanoninen polku, accepted Goal/ADR, deployment boundary tai persistent handoff muuttuu.
