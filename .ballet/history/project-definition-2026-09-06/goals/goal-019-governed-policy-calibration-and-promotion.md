---
id: goal-019
title: Hallittu policy-kalibrointi ja mallipromootio
status: superseded
createdAt: '2026-08-23T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - tavoite
  - policy
  - calibration
  - governance
version: 3
---

# Hallittu policy-kalibrointi ja mallipromootio

> Superseded by `goal-020`. Calibration/shadow/promotion ei kuulu aktiiviseen tuotteeseen.

## Tavoite

Ballet muodostaa immutable `ssp_v2`-havainnoista deterministisiä offline-dataset-snapshotteja, kalibroi niistä eksplisiittisten expert priorien avulla immutable candidate modeleja ja arvioi niitä ennen yhtäkään live-aktivointia. Routing minimoi edelleen project-local-säännöllä deterministisesti scalarisoitua odotettua cost-to-go'ta; havainto ei päivitä käynnissä olevaa tai promotoitua mallia.

`agent_v1` voi säilyä controllerina samalla, kun yksi nimetty `ssp_v2`-candidate arvioi saman canonical decision epochin ja hard admissible action setin read-only shadow'na. Shadow-valinta ei ole toteutunut counterfactual eikä kalibrointihavainto.

## Käyttäjäarvo

- Kesto, provider-neutral usage, retryt sekä tunnetut monetary/utility-dimensiot säilyvät erillisinä havaintoina; tuntematon arvo ei muutu nollaksi.
- Jokainen dataset, candidate, evaluation report, promotion proposal, activation ja rollback on hashattava sekä lineage-jäljitettävä.
- Candidate voidaan ehdottaa automaattisesti vain hyväksyttyjen readiness- ja evaluation-rajojen läpäisyn jälkeen.
- Vain ihminen voi aktivoida candidate-hashin uusiin Runeihin tai palauttaa aiemman immutable mallin; käynnissä olevan Runin snapshot ei muutu.

## Rajaus

Tavoite kattaa master-roadmapin vaiheet 2–7: option-cost-evidenssin, offline-kalibroinnin ja registry'n, policy evaluationin, shadow moden, ihmisvaltuutetun pilotin sekä promotion proposal -silmukan.

Tavoite ei kata in-place online learningia, shadow-actionin käsittelyä counterfactual-evidenssinä, automaattista aktivointia, profile-aware Optioneita, Portti B:n agent-routerien poistoa eikä external writea.

## Hyväksymisaie

`QS-025` omistaa immutable learning/promotion -ketjun fail-closed-kriteerit. Toteutus tarvitsee koordinoidun strict contract cutin, hierarchy-safe-kustannusattribuution, deterministic dataset/calibration/evaluation-testit, shadow-provenancen sekä ihmisvaltuutuksen osoittavan activation/rollback-evidenssin.

Project-local outcome-katalogit, priorit, scalarization-parametrit, readiness-thresholdit, promotion-thresholdit, pilotin budgetit ja stop-ehdot authoroidaan eksplisiittisesti ennen niiden käyttöä; tämä Goal ei keksi niiden arvoja.

## Ihmispäätös

Project owner hyväksyi `goal-019`:n ja `adr-030`:n commitissa `26698dda09c9e9fda5284d4bfa578d6084581dc5`. Hyväksyntä valtuuttaa vaiheittaisen Phase 2–7 -toteutuksen hyväksyttyjen stop-ehtojen mukaisesti, mutta se ei aktivoi mallia, käynnistä pilottia tai valtuuta Portti B:tä.
