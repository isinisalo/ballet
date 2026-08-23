---
id: graph-reward-mdp-review
title: Graph Reward-MDP initiative review
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 3
tags:
  - arc42
  - initiative
  - review
---

# Graph Reward-MDP REVIEW

## Nykytila

Implementation, kanoninen arkkitehtuurikatko ja tekniset final gatet ovat läpäisseet review'n. Strict contractit, compiler/runtime, default Graph, ordered Action Node execution sekä ADR-032:n visuaalinen Decision Model on toteutettu. Initiative jää `review`-tilaan vain siksi, ettei tuotantokaltaiselle Root Run -pilotille ole tässä työssä valtuutusta tai evidenssiä.

## Findingit

- Aiempi scoped agent/SSP/Repair/promotion-ketju oli aktiivisissa dokumenteissa päällekkäinen uuden control ownerin kanssa; `adr-031` supersedoi täsmälliset osat.
- Runtime-datan puuttuminen oikeutti legacy-migraation poistamisen mutta ei oikeuta väittämään Reward-MDP-pilottia suoritetuksi.
- Symmetric default-priori on läpinäkyvä heikko prior, ei kalibroitu arvio.
- Browser QA löysi Reward‑MDP-headerin narrow-leikkauksen; korjauksen jälkeen desktop/narrow page-overflow, clipped core action ja console warning/error ovat nolla.
- Projektin omistaja hylkäsi raw-micros-inputit ja raskaat transition/Q/V-taulukot sekä hyväksyi PNG-konseptin toteutuksen lähtökohdaksi. ADR-032:n production-build-QA todentaa pulse/horizon/impact/heatmap-rakenteen, punaisen `−/cost`- ja vihreän `+/reward`-semantiikan, ihmisyksiköt, exact title -detailin sekä nolla primary form/table -elementtiä. Final project-owner pixel verdictiä ei päätellä toteutuspyynnöstä.
- Final adversarial review löysi odotetusta branch-statesta lasketun realized rewardin: runtime käyttää nyt factual projected statea ja regression todistaa state-missin eri rewardin. Samassa katselmoinnissa poistettiin käyttämättömät SSP-peräiset projection-rajat ja muutettiin 256 transition -raja sulkevaksi ennen dispatchia.

## QS-verdict

`QS-026`: tekninen acceptance passed GRM-evid-004:n rajoissa; ADR-032:n visual projection passed GRM-evid-006:n rajoissa; operational pilot pending GRM-evid-005. `QS-024`: automated ja desktop/narrow production-build browser QA passed, mutta final project-owner pixel verdictiä ei väitetä. External writea ei ole valtuutettu.

## Handoff

Seuraava hyväksyttävä toimi on erikseen valtuutettu tuotantokaltainen viiden GraphNoden pilotti. Siihen asti compiled policy, runtime ja UI ovat teknisesti hyväksyttyjä, mutta operational method-impact pysyy `not measured`.
