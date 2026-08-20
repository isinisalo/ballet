---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 10
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin ja jatkuvaan kehitysmenetelmään. Lue ensin nykytila ja tarvittava arc42-osio; älä päättele project workflow’ta runtime-koodista tai kopioi machine-local-tilaa dokumentaatioksi.

## Tila

- `goal-001`–`goal-012` omistavat hyväksytyn WHAT/WHY:n.
- Virallisen [arc42-rakenteen 12 osiota](https://docs.arc42.org/home/) ovat kanonisesti `.ballet/arc42/`-hakemistossa.
- `goal-009` ja `adr-011` hyväksyvät jatkuvan Ballet Methodin; `adr-019` supersedoi vain kiinteän 6+1-topologian ja materialisoi architecture-significant vastuut yhden done-conditionin capability-Loopeiksi.
- `goal-010` ja `adr-016` hyväksyvät yhden Loopin authoring package -rajan: paketti materialisoidaan project-local-runtime-resursseiksi eikä ole live runtime dependency.
- Nykyinen project config-, shared contract-, immutable snapshot- ja Loop module -baseline on strict v11: `graph.loopEdges` omistaa peer-reitit ja jokainen Loop ilmoittaa namespaced `accepts`/`provides`-capabilityt.
- Nykyinen project-local-baseline sisältää 11 Loopia, 20 Work Loop Nodea ja 62 graph-edgeä. Rakennesuunnittelu on erotettu solution strategy-, Building Block View- ja runtime/deployment-Loopeiksi; crosscutting concepts ja architecture decision ovat erilliset Loopit.
- Cross-Loop-runtime toteuttaa `goal-012` / `adr-018`:n Orchestrator-owned flow/repair-dispatchin immutable snapshotista ja SQLite schema v7:n canonical request/route-evidenssistä. Authoring-UI käyttää vain URL-ohjattuja Graph Engineering- ja selected-Loop-only Loop Engineering -näkymiä; Context ja numeric level -reitit on poistettu. Graph Engineering projisoi täsmälleen yhden Orchestrator-control-noden, yhden LoopNoden per `ProjectLoop` sekä persisted policyyn ja canonical Run -evidenssiin sidotut flow/repair-reitit lisäämättä runtime-entiteettiä.
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

`adr-011` määrittää source-of-truth- ja menetelmärajan. `adr-015` määrittää Work/Validation-rakenteen, State-revisiot, repairin ja continuationin. `adr-016` supersedoi vain ADR-014:n no-package-V1-rajan. `adr-017` säilyttää historiallisen v10-authoring-baselinen. `adr-018` supersedoi sen Context/numeric-level-mallin sekä ADR-015:n automaattisen `followFlow`-kohdan säilyttäen selected-Loop-only- ja repair/State/continuation-invariantit. `adr-019` supersedoi ADR-011:stä vain kiinteän kuuden arc42-Loopin topologian ja säilyttää menetelmä-, State- ja ihmisrajat.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumentit, traceabilityn, project-resurssit ja strict-v11 Graph/capability-sopimuksen. Runtime-, module-, provider-, recovery- ja UI-testit tarkistavat toteutuksen. Aktiivisen Root Runin execution truth tulee immutable snapshotista ja canonical SQLite -faktoista; pitkäikäinen hyväksymisevidenssi indeksoidaan initiative-EVIDENCEen.

## Avoimet kysymykset

- Mikä rajattu initiative toimii ensimmäisenä yhden vastuun Ballet Method -topologian end-to-end-pilottina?
- Mitkä lähtöarvot ensimmäinen pilotti tuottaa METHOD-HEALTH-mittareille?
- Hyväksyykö projektin omistaja `graph-and-loop-engineering`-initiativen koko `EVID-014`-ketjun paikallisen implementation-evidenssin ja erillisen ihmisreview'n jälkeen?
- Hyväksyykö projektin omistaja `comprehensive-arc42-documentation`-draftin lopputarkistuksen jälkeen?

## Seuraava katselmointiperuste

Katselmoi aloituspiste, kun kanoninen polku, accepted Goal/ADR, deployment boundary tai persistent handoff muuttuu.
