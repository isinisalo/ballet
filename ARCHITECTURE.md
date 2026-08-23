---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 19
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin ja jatkuvaan kehitysmenetelmään. Lue ensin nykytila ja tarvittava arc42-osio; älä päättele project-local-menetelmää runtime-koodista tai kopioi machine-local-tilaa dokumentaatioksi.

## Tila

- `goal-001`–`goal-016` omistavat hyväksytyn WHAT/WHY:n. `goal-017` ja `goal-018` ovat review-tilassa Portti A:n implementation- ja hyväksyntärajalla.
- `goal-016` / `adr-026` hyväksyy finite SSP/SMDP Graph-policy -strategian. Se erottaa Capability Graphin, Decision Modelin, Policy Projectionin ja Execution Graphin sekä säilyttää explicit `agent_v1`-vaihtoehdon ilman fallbackia.
- Virallisen [arc42-rakenteen 12 osiota](https://docs.arc42.org/home/) ovat kanonisesti `.ballet/arc42/`-hakemistossa.
- `goal-009` ja `adr-011` hyväksyvät jatkuvan Ballet Methodin. `goal-015` / `adr-023` materialisoi repositoryn nykyisen oletusmenetelmän viideksi project-local GraphNodeksi ja 17 aggregate JobNodeksi muuttamatta platformin geneeristä 1–40 GraphNoden rajaa.
- `goal-010` / `adr-016`:n säilyvä package trust -periaate toteutuu Graph Node Module v5 -rajassa: paketti materialisoidaan project-local-runtime-resursseiksi eikä ole live runtime dependency.
- Nykyinen Portti A -implementation cut on strict project config v16, Graph Node Module v5, Root Execution Snapshot v9, Task Envelope / node outcome v8, ExecutionSpec v10 / composition v9 ja SQLite schema v12. Compatibility-readereita, reittialiaksia, dual-writeä tai runtime-migraatiota ei ole.
- `ProjectGraphNode` omistaa scoped orchestrator/repairin ja aggregate JobNodet. JobNode omistaa Work/Validation-lapset ja bounded retryn. Globaali ja paikalliset orchestratorit käyttävät project-datan Luna/medium/network-off-profiilia; Repair Nodet Sol/medium/network-off-profiilia. Platform ei hardkoodaa mallia eikä tee fallbackia.
- `agent_v1` ja outcome-aware `ssp_v2` ovat eksplisiittiset strategiat sekä Graph- että GraphNode-scopeissa ilman fallbackia. `ssp_v2` ratkaisee GraphNode- ja JobNode-actionit scoped proper policylla, tallentaa semantic outcome + PASS/FAIL + actual projected state -havainnon ja ratkaisee seuraavan decision epochin actual statesta. Work→Validation, retry ja bounded same-Validation Repair säilyvät.
- Authoring-UI käyttää kolmea canonical routea. Graph Engineering jakautuu Capability Graph / Decision Model -korttiosioihin ja Graph Node Jobs / Local Decision Model & Repair -osioihin. Job Node käyttää ADR-025/027:n industrial flow -projektiota. URL omistaa hierarkian, sectionin ja browser historyn.
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

`adr-011` määrittää source-of-truth- ja menetelmärajan. `adr-015` säilyttää State-, repair- ja continuation-invariantit. `adr-016` säilyttää package trust/materialisointi -periaatteen. `adr-023` omistaa säilyvän domain- ja Repair-rajan; `adr-025` ja `adr-027` omistavat Job Node industrial flow'n. Review-tilaiset `adr-028` ja `adr-029` dokumentoivat Portti A:n hierarchical policy- ja capability-first-implementationin sekä tarkan supersession-rajan.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumentit, traceabilityn, project-resurssit ja strict-v16 Graph/GraphNode/JobNode/strategy-sopimuksen. Runtime-, policy-, tracker-, module-, provider-, recovery- ja UI-testit tarkistavat toteutuksen. Aktiivisen Root Runin execution truth tulee immutable snapshotista ja canonical SQLite -faktoista; pitkäikäinen hyväksymisevidenssi indeksoidaan initiative-EVIDENCEen.

## Avoimet kysymykset

- Mikä viiden GraphNoden Graph Run toimii ensimmäisenä end-to-end-pilottina?
- Mitkä lähtöarvot ensimmäinen pilotti tuottaa METHOD-HEALTH-mittareille?
- Hyväksyykö projektin omistaja `three-level-graph-node-engineering`-initiativen `EVID-019`–`EVID-020`-ketjun, conformance-gatejen ja kolmen canvasin visual QA:n jälkeen?
- Hyväksyykö projektin omistaja `comprehensive-arc42-documentation`-draftin lopputarkistuksen jälkeen?
- Mitkä domain expertin kalibroimat outcome-katalogit, priors/costit ja bounded featuret valitaan ensimmäiseen `ssp_v2`-pilottiin?
- Hyväksyykö projektin omistaja ADR-028/029:n ja milloin Portti B:n agent-routerien poisto valtuutetaan pilotin jälkeen?

## Seuraava katselmointiperuste

Katselmoi aloituspiste, kun kanoninen polku, accepted Goal/ADR, deployment boundary tai persistent handoff muuttuu.
