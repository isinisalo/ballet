---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 15
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin ja jatkuvaan kehitysmenetelmään. Lue ensin nykytila ja tarvittava arc42-osio; älä päättele project-local-menetelmää runtime-koodista tai kopioi machine-local-tilaa dokumentaatioksi.

## Tila

- `goal-001`–`goal-015` omistavat hyväksytyn WHAT/WHY:n.
- Virallisen [arc42-rakenteen 12 osiota](https://docs.arc42.org/home/) ovat kanonisesti `.ballet/arc42/`-hakemistossa.
- `goal-009` ja `adr-011` hyväksyvät jatkuvan Ballet Methodin. `goal-015` / `adr-023` materialisoi repositoryn nykyisen oletusmenetelmän viideksi project-local GraphNodeksi ja 17 aggregate JobNodeksi muuttamatta platformin geneeristä 1–40 GraphNoden rajaa.
- `goal-010` / `adr-016`:n säilyvä package trust -periaate toteutuu Graph Node Module v4 -rajassa: paketti materialisoidaan project-local-runtime-resursseiksi eikä ole live runtime dependency.
- Nykyinen baseline on strict project config v14, Graph Node Module v4, Root Execution Snapshot v7, Task Envelope / node outcome v7, ExecutionSpec v9 / composition v8 ja SQLite schema v10. Compatibility-readereita, reittialiaksia, dual-writeä tai runtime-migraatiota ei ole.
- `ProjectGraphNode` omistaa scoped orchestrator/repairin ja aggregate JobNodet. JobNode omistaa Work/Validation-lapset ja bounded retryn. Globaali ja paikalliset orchestratorit käyttävät project-datan Luna/medium/network-off-profiilia; Repair Nodet Sol/medium/network-off-profiilia. Platform ei hardkoodaa mallia eikä tee fallbackia.
- Runtime kutsuu Graph Orchestratoria Graph Runin alussa ja GraphNode-tulosten jälkeen sekä Graph Node Orchestratoria GraphNode-ajon alussa ja JobNode-tulosten jälkeen. Work→Validation ja retry ovat ainoat kiinteät child-siirtymät. Repair on bounded same-Validation call/return, joka ei laajenna snapshotin targetteja tai oikeuksia.
- Authoring-UI käyttää kolmea canonical canvas-routea: Graph Engineering ja Graph Node säilyttävät planet/multi-ring-avaruusprojektion, Job Node käyttää ADR-025:n industrial flow -projektiota. URL omistaa hierarkian ja browser historyn; Job-flow ei muuta runtime routingia.
- Root Runin Graph/GraphNode-projektio ja live inspector tulevat canonical snapshot/persistencestä eivätkä muodosta uutta control statea. Standalone JobNode Run ja schedule eivät kuulu aktiiviseen malliin.
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

`adr-011` määrittää source-of-truth- ja menetelmärajan. `adr-015` säilyttää State-, repair- ja continuation-invariantit. `adr-016` säilyttää package trust/materialisointi -periaatteen. `adr-023` omistaa nykyisen domain-, routing-, repair-, version- ja module-rajan; `adr-025` omistaa Job Node -canvasin industrial flow -projektion muuttamatta näitä runtime-invariantteja.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumentit, traceabilityn, project-resurssit ja strict-v14 Graph/GraphNode/JobNode/candidate-sopimuksen. Runtime-, tracker-, module-, provider-, recovery- ja UI-testit tarkistavat toteutuksen. Aktiivisen Root Runin execution truth tulee immutable snapshotista ja canonical SQLite -faktoista; pitkäikäinen hyväksymisevidenssi indeksoidaan initiative-EVIDENCEen.

## Avoimet kysymykset

- Mikä viiden GraphNoden Graph Run toimii ensimmäisenä end-to-end-pilottina?
- Mitkä lähtöarvot ensimmäinen pilotti tuottaa METHOD-HEALTH-mittareille?
- Hyväksyykö projektin omistaja `three-level-graph-node-engineering`-initiativen `EVID-019`–`EVID-020`-ketjun, conformance-gatejen ja kolmen canvasin visual QA:n jälkeen?
- Hyväksyykö projektin omistaja `comprehensive-arc42-documentation`-draftin lopputarkistuksen jälkeen?

## Seuraava katselmointiperuste

Katselmoi aloituspiste, kun kanoninen polku, accepted Goal/ADR, deployment boundary tai persistent handoff muuttuu.
