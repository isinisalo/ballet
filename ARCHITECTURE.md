---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-21'
version: 13
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin ja jatkuvaan kehitysmenetelmään. Lue ensin nykytila ja tarvittava arc42-osio; älä päättele project workflow’ta runtime-koodista tai kopioi machine-local-tilaa dokumentaatioksi.

## Tila

- `goal-001`–`goal-014` omistavat hyväksytyn WHAT/WHY:n.
- Virallisen [arc42-rakenteen 12 osiota](https://docs.arc42.org/home/) ovat kanonisesti `.ballet/arc42/`-hakemistossa.
- `goal-009` ja `adr-011` hyväksyvät jatkuvan Ballet Methodin. `adr-022` materialisoi repositoryn nykyisen oletusmenetelmän viideksi toimitus-Loopiksi ja DESIGNin 12 arc42-JobNodeksi muuttamatta platformin geneeristä 1–40 Loopin rajaa.
- `goal-010` ja `adr-016` hyväksyvät yhden Loopin authoring package -rajan: paketti materialisoidaan project-local-runtime-resursseiksi eikä ole live runtime dependency.
- Nykyinen baseline on strict project config v13, Loop Module v3, Root Execution Snapshot v6, Task Envelope / node outcome v6, execution spec v8 / composition v7 ja SQLite schema v9. Graph erottaa named `transitions`- ja capability `repairEdges` -reitit; compatibility-readereita ei ole.
- Nykyinen project-local-baseline sisältää viisi Loopia: DESIGN, PLAN, BUILD, DEPLOY ja VERIFY. DESIGNissa on 12 järjestettyä arc42-Job/Validation-paria, koko RunBookissa 18 nimettyä transitionia ja oletuksena 0 repair-edgeä. Story/Release Map on versionhallittu ja implementation-taskit asuvat vain worktreen `tk`-storessa.
- Cross-Loop-runtime toteuttaa `goal-014` / `adr-022`:n exact `(source, decision, outcome)`-reitityksen immutable snapshotista ilman tavallisen flow-targetin LLM-päättelyä. `goal-013` / `adr-020` omistaa edelleen valitun Loopin erilliset Job/Validation-domainnodet, Pass/Fail Edget, retry- ja repair-return-invariantit. `adr-021` suojaa Workflow-canvasin yhden Job-artworkin projektion ja avaruusteeman. Authoring-UI käyttää vain Graph Engineering- ja selected-Loop-only Workflow Engineering -näkymiä; Graph käyttää pelkistettyä kerrostettua korttiesitystä, yhtä Orchestrator-controlia ja DONE-terminalia.
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

`adr-011` määrittää source-of-truth- ja menetelmärajan. `adr-015` säilyttää State-, repair- ja continuation-invariantit. `adr-016` omistaa materialisoitavan yhden Loopin package-rajan. `adr-020` ja `adr-021` omistavat Workflow-domainin ja suojatun canvas-projektion. `adr-022` supersedoi ADR-018:n tavallisen flow-targetin agenttivalinnan ja ADR-019:n repositoryn oletus-arc42-granulariteetin; niiden Graph/Workflow-, repair-, package- ja project/platform-rajat säilyvät.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumentit, traceabilityn, project-resurssit ja strict-v13 Workflow/Graph/transition/repair-sopimuksen. Runtime-, tracker-, module-, provider-, recovery- ja UI-testit tarkistavat toteutuksen. Aktiivisen Root Runin execution truth tulee immutable snapshotista ja canonical SQLite -faktoista; pitkäikäinen hyväksymisevidenssi indeksoidaan initiative-EVIDENCEen.

## Avoimet kysymykset

- Mikä viiden Loopin RunBook-release toimii ensimmäisenä end-to-end-pilottina?
- Mitkä lähtöarvot ensimmäinen pilotti tuottaa METHOD-HEALTH-mittareille?
- Hyväksyykö projektin omistaja `graph-and-loop-engineering`-initiativen koko `EVID-014`-ketjun paikallisen implementation-evidenssin ja erillisen ihmisreview'n jälkeen?
- Hyväksyykö projektin omistaja `workflow-engineering`-initiativen `EVID-015`-ketjun teknisten gatejen ja desktop/narrow-ihmisreview'n jälkeen?
- Hyväksyykö projektin omistaja `graph-engineering-runbook`-initiativen `EVID-016`–`EVID-018`-ketjun, live `tk`-smoken tilan ja Graph/Workflow visual QA:n jälkeen?
- Hyväksyykö projektin omistaja `comprehensive-arc42-documentation`-draftin lopputarkistuksen jälkeen?

## Seuraava katselmointiperuste

Katselmoi aloituspiste, kun kanoninen polku, accepted Goal/ADR, deployment boundary tai persistent handoff muuttuu.
