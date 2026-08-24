---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 24
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin. Pitkäikäinen project truth on Goal/ADR/arc42/initiative-ketjussa; runtime truth on immutable Root Snapshotissa ja SQLite-faktoissa. Project-local-menetelmää ei päätellä platform-koodista eikä runtime-lokeja kopioida dokumentaatioksi.

## Aktiivinen nykytila

- `goal-021` ja `adr-033` omistavat hierarkkisen Reward-MDP:n: Graph-scope käyttää GraphNode-ID:itä ja jokainen GraphNode omia ActionNode-ID:itään sekä state- että action-joukkona.
- Default Graph on 5×5 (15/25 authoroitua solua), PLAN 2×2 (3/4) ja DESIGN 12×12 (78/144). Terminalit ovat branch targetteja, eivät policy-stateja.
- Validation palauttaa typed ActionNode-outcomen local policylle. Local terminal emittoi GraphNode-outcomen global policylle; bounded FAIL on `retry | escalate`, mutta kumpikaan ei ohita local branchia.
- Acceptance-ledger kuuluu Graphille ja on erillinen evidenssiportti. Vain eksplisiittisesti sidotut obligaatiot vaikuttavat Graph-potentialiin; sitomaton node, Action-split tai duplicate verification antaa progress-rewardia nolla.
- Reward on scopekohtainen `terminalSuccessBonus − actionCost − outcomePenalty`, Graphissa lisäksi `γΦ(target) − Φ(s)`. Kaikki rewardit ovat integer-mikroyksikköjä ja probabilityt integer-ppm:iä.
- Transitionit mallintavat `P(outcome,s′|s,a)`:n. Authoroimattoman tiedon läpinäkyvä prior on exact-ppm symmetric Dirichlet(1), provenance `default_prior`; runtime ei opi siitä online.
- Global ja reachable local policyt compileutuvat erikseen kerran immutable Root Snapshotiin deterministic iteration boundilla, stable tie-breakillä ja absorption-checkillä. Havaittu typed outcome valitsee branchin deterministisesti; runtime ei arvo seuraajaa.
- Authorization tulee erillisestä immutable snapshotista. Unauthorized action ei kuulu `A(s)`:ään eikä project State voi antaa sille lupaa.
- Aktiivinen strict cut on Project Config v19, Decision Model v4, Graph Node Module v7, Root Snapshot v12, Task Envelope/Outcome v9, composition v10, ExecutionSpec v11, policy decision/observation v5 ja SQLite v15. Legacy-readeria, migraatiota, aliasia tai dual-writeä ei ole.
- Repositoryn project-local default sisältää DESIGN/PLAN/BUILD/DEPLOY/VERIFY-GraphNodet ja 17 ActionNodea. Platform tuntee vain geneeriset primitivit.
- UI säilyttää capability-first-kortit ja ADR-025/027:n protected Action Node flow'n. Graph ja GraphNode näyttävät semanttisen CSS-grid 5×5/N×N Q(s,a)-matriisin, vihreän `+reward`-, punertavan `−cost`- ja amber `≈estimate`-semantiikan sekä exact micros/ppm-detailin.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen.

## Supersession

`goal-021` supersedoi `goal-020`:n single-policy/ledger-state/array-order-osat. `adr-033` supersedoi vastaavat ADR-031:n osat ja ADR-032:n 62-state landscape/pulse/horizon -projektion. Vanhat tiedostot säilyvät audit trailina. ADR-031:n deterministic outcome-aware reward/authorization, ADR-032:n ihmisyksiköt/värisemantiikka ja ADR-025/027:n Action flow säilyvät.

## Kanoniset lähteet

- [arc42-indeksi](.ballet/arc42/README.md)
- [status ja handoff](.ballet/arc42/STATUS.md)
- [traceability](.ballet/arc42/TRACEABILITY.md)
- [method health](.ballet/arc42/METHOD-HEALTH.md)
- [State-sopimus](.ballet/arc42/STATE-CONTRACT.md)
- [Goal-yhteenveto](.ballet/goals/summary.md)
- [ADR-indeksi](.ballet/arc42/09-architecture-decisions.md)
- [UI-designjärjestelmä](DESIGN.md)
- [Hierarchical Reward-MDP initiative](.ballet/arc42/initiatives/hierarchical-reward-mdp/BRIEF.md)

## Omistajuus

1. Goalit omistavat WHAT/WHY:n.
2. ADR:t omistavat riskialttiit ja vaikeasti peruttavat päätökset sekä supersessionin.
3. arc42-osiot 1–12 omistavat pitkäikäiset näkymät, konseptit, laadun ja riskit.
4. Initiative BRIEF/PLAN/EVIDENCE/REVIEW omistaa rajatun muutoksen sopimuksen ja todellisen näytön.
5. `DESIGN.md` omistaa visuaalisen järjestelmän; `.ballet/project.json` project-local automaatiodatan.
6. `.git/ballet` omistaa machine-local runtime-tilan, ei arkkitehtuuritekstiä.

## Evidenssi ja avoin riski

`npm run validate:arc42` tarkistaa dokumentti-, trace-, resource- ja strict-v19 hierarchical Reward-MDP -sopimuksen. Testit, lint, build, module-smoket, platform boundary, `make latest` ja käynnistyssmoke muodostavat teknisen acceptance-portin. Tuotantokaltaista Root Run -pilottia ei ole suoritettu; sitä ei saa päätellä hermetic testeistä.

## Seuraava katselmointiperuste

Katselmoi entrypoint, kun accepted Goal/ADR, strict version matrix, deployment boundary tai persistent handoff muuttuu.
