---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 25
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

## Hyväksytty target ja transition

`goal-022` ja `adr-034` hyväksyvät strict targetin Environment → State → Action, approved Use Caset, Validation-led precheck/Work/postwork-loopin, runtime-statuksesta johdetut `done`/`blocked`-portit, Feedback/Critic/Refinement-human approval -rajat sekä immutable continuation/Product Snapshot -evidenssin. Target matrix on Project Config v20, Snapshot v13, Task/outcome v10, composition v11, ExecutionSpec v12, SQLite v16 ja Feedback/Critic/Refinement v1; Reward-MDP/Graph/GraphNode/ActionNode/policy/acceptance ledger/Graph Node Module poistuvat lopputilasta.

Toteutusbaseline pysyy yllä kuvattuna strict v19:nä phase 09:n atomiseen cutoveriin asti. Phases 02–08 saavat käyttää vain dataeristettyä vNext-namespacea, `/api/vnext`-API:a ja `/vnext`-UI:ta. V19 ja vNext eivät lue tai kirjoita toisiaan, dual-writeä/compatibility readeria/migraatiota/route aliasia ei ole, ja phase 09 poistaa sekä vanhan aktiivipolun että kaikki vNext-prefixit. Targetin kanoninen rajaus on [Target Contract](.ballet/arc42/initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md).

## Supersession

`goal-021` supersedoi `goal-020`:n single-policy/ledger-state/array-order-osat. `adr-033` supersedoi vastaavat ADR-031:n osat ja ADR-032:n 62-state landscape/pulse/horizon -projektion. Vanhat tiedostot säilyvät audit trailina. ADR-031:n deterministic outcome-aware reward/authorization, ADR-032:n ihmisyksiköt/värisemantiikka ja ADR-025/027:n Action flow säilyvät.

Accepted `goal-022` / `adr-034` supersedoi phase 09:n final cutissa `goal-021`:n ja ADR-016/023/025/027/029/031/032/033:n nimeämät Graph/module/policy/matrix/control-osat. Ennen phase 09:ää tämä on hyväksytty target-päätös, ei väite toteutetusta runtime-cutista. Checkout-local-, provider-, worktree-, immutable evidence-, security-, design token- ja external-write-periaatteet säilyvät.

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
- [Environment orchestration target](.ballet/arc42/initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md)

## Omistajuus

1. Goalit omistavat WHAT/WHY:n.
2. ADR:t omistavat riskialttiit ja vaikeasti peruttavat päätökset sekä supersessionin.
3. arc42-osiot 1–12 omistavat pitkäikäiset näkymät, konseptit, laadun ja riskit.
4. Initiative BRIEF/PLAN/EVIDENCE/REVIEW omistaa rajatun muutoksen sopimuksen ja todellisen näytön.
5. `DESIGN.md` omistaa visuaalisen järjestelmän; `.ballet/project.json` project-local automaatiodatan.
6. `.git/ballet` omistaa machine-local runtime-tilan, ei arkkitehtuuritekstiä.

## Evidenssi ja avoin riski

`npm run validate:arc42` tarkistaa tällä hetkellä dokumentti-, trace-, resource- ja strict-v19 hierarchical Reward-MDP -sopimuksen. `EVID-028`–`EVID-032` ovat pending, joten accepted targetista ei päätellä toteutusta. Testit, lint, build, manifestin removal-gatet, platform boundary, `make latest` ja käynnistyssmoke muodostavat tulevan teknisen acceptance-portin.

## Seuraava katselmointiperuste

Katselmoi entrypoint, kun accepted Goal/ADR, strict version matrix, deployment boundary tai persistent handoff muuttuu.
