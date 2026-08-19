---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-19'
version: 5
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
- `goal-009` ja `adr-011` hyväksyvät 6+1 Ballet Methodin.
- `goal-010` ja `adr-016` hyväksyvät yhden Loopin authoring package -rajan: paketti materialisoidaan project-local-runtime-resursseiksi eikä ole live runtime dependency.
- Nykyinen toteutettu authoring-baseline on `goal-011` / `adr-017`: strict-v10 Context-, composition- ja selected-Loop detail -projektiot ilman uusia runtime-entiteettejä.
- `goal-012` ja `adr-018` hyväksyvät tulevan strict-v11 hard cut -tavoitteen: täsmälleen Graph Engineering ja Loop Engineering, first-class Loop capability metadata sekä kaikki cross-Loop-valinnat Orchestratorin kautta. Päätös ei vielä ole runtime- tai UI-toteutus.
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

`adr-011` määrittää source-of-truth- ja menetelmärajan. `adr-015` määrittää Work/Validation-rakenteen, State-revisiot, repairin ja continuationin. `adr-016` supersedoi vain ADR-014:n no-package-V1-rajan. `adr-017` määrittää nykyisen v10-authoring-baselinen. `adr-018` supersedoi osittain ADR-017:n Context/numeric-level-mallin sekä ADR-015:n automaattisen `followFlow`-kohdan säilyttäen selected-Loop-only- ja repair/State/continuation-invariantit.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumentit, traceabilityn, project-resurssit ja strict-v10 Loop-graafin. Runtime-, module-, provider-, recovery- ja UI-testit tarkistavat toteutuksen. Aktiivisen Root Runin execution truth tulee immutable snapshotista ja canonical SQLite -faktoista; pitkäikäinen hyväksymisevidenssi indeksoidaan initiative-EVIDENCEen.

## Avoimet kysymykset

- Mikä rajattu initiative toimii ensimmäisenä 6+1-menetelmän end-to-end-pilottina?
- Mitkä lähtöarvot ensimmäinen pilotti tuottaa METHOD-HEALTH-mittareille?
- Milloin projektin omistaja valtuuttaa `graph-and-loop-engineering`-draft-PLANin ensimmäisen strict-v11-toteutusvaiheen?
- Hyväksyykö projektin omistaja `comprehensive-arc42-documentation`-draftin lopputarkistuksen jälkeen?

## Seuraava katselmointiperuste

Katselmoi aloituspiste, kun kanoninen polku, accepted Goal/ADR, deployment boundary tai persistent handoff muuttuu.
