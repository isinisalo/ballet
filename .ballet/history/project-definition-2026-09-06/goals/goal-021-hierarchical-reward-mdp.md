---
id: goal-021
title: Graph Engineering käyttää hierarkkista node-omisteista Reward-MDP:tä
status: superseded
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - tavoite
  - reward-mdp
  - hierarkia
---

# Graph Engineering käyttää hierarkkista node-omisteista Reward-MDP:tä

## Tavoite

Ballet erottaa Graphin GraphNode-valinnan ja GraphNoden ActionNode-valinnan kahdeksi sisäkkäiseksi Reward-MDP-scopeksi. Policy-state ja action ovat aina scopea omistavan noden ID:itä: default Graph on 5×5, PLAN 2×2 ja DESIGN 12×12. Terminalit ovat branch targetteja, eivät matriisirivejä.

## Käyttäjäarvo

- Operaattori näkee yhdellä silmäyksellä nykytilan, valittavat nodet, puuttuvat solut sekä palkitsevat ja kalliit siirtymät.
- Uusi GraphNode kasvattaa vain Graph-matriisia. Kymmenen nodea tekee 15×15-matriisin mutta ei lisää acceptance-ledgeriin obligaatiota.
- ActionNoden pilkkominen kasvattaa vain oman GraphNoden paikallista matriisia eikä tuota Graph-progress-rewardia.
- Acceptance-ledger säilyy evidenssi- ja siirtymäporttina eikä muodosta policy-statejen karteesista tuloa.
- Exact micros/ppm säilyvät sopimuksessa ja accessible detailissä; ensisijainen UI näyttää ihmisyksiköt, merkin ja semanttisen värin.

## Rajaus

Tavoite kattaa global/local compilerit, immutable snapshotin, deterministic branch-valinnan havaitulla typed outcomella, local-terminalin GraphNode-outcomen, acceptance-effectien exact-portin, yhteisen 256 päätöksen Root Run -rajan, Module v7:n paikallisen policyn, node-ID-atomisuuden sekä 5×5/N×N authoring-projektion.

Online learning, vapaa state-katalogi, terminal-rivit, automaattinen acceptance-obligaation luonti, vanhan datan migraatio ja external write eivät kuulu tavoitteeseen.

## Hyväksymisaie

`QS-027` / `TEST-027` vaativat Config v19 / Decision Model v4 / Module v7 / Snapshot v12 / decision+observation v5 / SQLite v15 -hard cutin, default 15/25 + PLAN 3/4 + DESIGN 78/144 -solut, global→local→Action→local→global-ajon, exact ledger-portin, CRUD/module-roundtripin, 1/5/40 × 1/17/64-UI-fixturet ja täydet repository-portit.

## Supersession

Tämä Goal supersedoi `goal-020`:n yhden policy-scopen, ledger-state-avaruuden ja ordered array -suorituksen. `goal-020`:n outcome-aware reward, hard authorization, deterministic compiler, immutable snapshot ja bounded Work→Validation retry säilyvät.

## Ihmispäätös

Projektin omistajan 2026-08-23 antama “Hierarkkinen 5×5 / N×N Reward-MDP” -toteutuspyyntö hyväksyi WHAT/WHY:n, strict hard cutin, default-matriisit, UI-projektion ja legacy-poiston. Se ei valtuuta releaseä, deployta, mergeä, pushia tai muuta ulkoista kirjoitusta.
