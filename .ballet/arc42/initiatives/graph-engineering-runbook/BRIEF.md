---
id: graph-engineering-runbook-brief
title: Graph Engineering RunBook initiative brief
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-20'
version: 1
tags:
  - arc42
  - initiative
  - graph-engineering
  - runbook
---

# Graph Engineering RunBook BRIEF

## Tarkoitus

Toteuta `goal-014` / `REQ-014`: Ballet-projektin oletustyönkulku on viiden project-local Loopin deterministinen RunBook ja implementation-työ sovitetaan pinnattuun `tk`:hon ilman platform-workflow'n kovakoodausta.

## Tila

`draft`. Käyttäjä hyväksyi WHAT/WHY:n, 18 transitionin matriisin, strict version cutin, `tk`-rajan ja visuaalisen rajauksen 2026-08-20. Toteutuksen ja evidenssin arviointi on kesken.

## Faktat ja päätös

- **Fact GER-FACT-001:** aiempi active baseline käytti strict-v12 `loopEdges`-graafia, 11 oletus-Loopia, agenttipohjaista tavallisen flow'n dispatchia ja Loop Module v2:ta.
- **Decision GER-DEC-001:** `adr-022` korvaa tavallisen flow'n exact named RunBook-transitionilla ja ryhmittelee repositoryn oletusmenetelmän viiteen Loopyyn.
- **Decision GER-DEC-002:** `tk`-revisio `d778bb520ee526c314c26f2bb876447e0a19caa5` on pakollinen Graph Run -preflightissa ja käyttää kahta worktree-sisäistä storea.
- **Decision GER-DEC-003:** Graph Engineering saa pelkistetyn korttiesityksen; Workflow Engineeringin avaruusteema on suojattu regressioraja.

## Rajaus

Sisällä ovat strict v13/v3/v6/v7/v8/v9 contracts, snapshot/runtime, Graph/isolated/scheduled/repair-semantics, tracker adapter/outbox/CLI, viisi project-local Loopia ja moduulia, Story/Release Map, Graph authoring/Run UI sekä tarpeellinen arc42/Goal/ADR/trace-evidenssi.

Rajauksen ulkopuolella ovat ticket-editori frontendissä, remote tracker, automaattinen deploy/merge/push, platformiin kovakoodattu release/arc42-workflow sekä Workflow Engineeringin visuaalinen uudelleenmuotoilu.

## Sidosryhmät ja odotukset

| Sidosryhmä | Odotus |
| --- | --- |
| Projektin omistaja | Näkee viisi Loopia, exact transitionit ja pysyy deploy-valtuutuksen omistajana. |
| Agenttioperaattori | Voi jäljittää current Loopin ja valitun decision/outcomen immutable snapshottiin. |
| Agentti | Saa terminal Validationissa vain sallitun outcome-enumin ja work-storeen rajatut tracker-komennot. |
| Ylläpitäjä | Saa fail-closed-preflightin, idempotentin reconciliationin ja vanhan DB:n archive/remediation-ohjeen. |
| Riippumaton katselmoija | Voi arvioida 18 transitionin, 1/5/40-layoutin ja tracker-fault-matriisin nimetystä evidenssistä. |

## Laatu ja acceptance

- `QS-016`: exact transition determinismi, snapshot immutability, 256-transition limit sekä Graph/Loop/scheduled/repair-erottelu.
- `QS-017`: Graphin 1/5/40-layout, tekstilliset edge-labelit, narrow viewport ja Workflow-visuaalinen regressio.
- `QS-018`: `tk`-preflight/outbox/reconciliation fail-closed, idempotentti ja yhden BUILD-issuen raja.

Acceptance vaatii `TEST-016`–`TEST-018`-matriisit sekä repositoryn standardigatet. Live `tk`-smoke voi olla pending ympäristösyystä, mutta sitä ei saa merkitä passediksi fake-CLI-evidenssillä.

## Oletukset, hypoteesi ja avoimet kysymykset

- **Assumption GER-ASSUMPTION-001:** pinnatun `tk`-revision CLI-sopimus pysyy source-commitin mukaisena; preflight tarkistaa tämän jokaisessa Runissa.
- **Hypothesis GER-HYPOTHESIS-001:** exact `(decision, outcome)`-transition poistaa tavallisen cross-Loop-targetin nondeterminismin ilman repair call/return -kyvyn heikkenemistä.
- **Open question GER-OQ-001:** ensimmäinen oikea Graph Run tuottaa vasta operatiivisen `tk`-häiriö- ja method-health-baselinen; se ei estä hermetic implementation acceptancea.

## Kanoniset lähteet

`goal-014`, `adr-022`, arc42-osiot, `.ballet/project.json`, `.ballet/releases/STORY-RELEASE-MAP.md`, source contracts/runtime/tracker/UI ja käyttäjän 2026-08-20 toimeksianto.

## Seuraava katselmointiperuste

Ready for review, kun PLANin kaikki implementointiaskeleet on verrattu diffiin ja EVIDENCE-rivit sisältävät todelliset testitulokset tai eksplisiittiset puutteet.
