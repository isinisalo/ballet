---
id: graph-reward-mdp-brief
title: Graph Reward-MDP initiative brief
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - reward-mdp
---

# Graph Reward-MDP BRIEF

## Tarkoitus ja päätös

Toteuta `goal-020` / `REQ-020` yhden Graph-tason Reward-MDP:nä ja poista aktiivisesta tuotteesta scoped agent/local-policy/Repair/shadow/promotion -mallit. Projektin omistaja hyväksyi WHAT/WHY:n, strict cutin ja reward-defaultit 2026-08-23 toteutuspyynnössä.

## Faktat lähtötilasta

Project data ja dokumentaatio olivat ristiriidassa strategiadefaultista; outcome ei vaikuttanut solverin rewardiin; runtime käytti päällekkäisiä scoped control-polkuja; solver ratkaisi immutablea mallia epochittain; runtime-DB ja UI sisälsivät ylimääräisiä vastuita. Runtime-kannassa oli nolla Runia ja nolla policy-havaintoa.

## Scope

Reward-MDP compiler/runtime, acceptance-ledger, authorization-snapshot, default Graph, ordered Action Node execution, strict sopimus-/SQLite-cut, legacy-poisto, Reward Decision Model UI, clean-architecture-jako ja kanoninen dokumentaatioketju.

## Ei kuulu scopeen

Online learning, calibrated/production pilotin keksiminen, external write, deploy/release/merge/push, uusi canvas-kieli tai vanhan kannan migraatio.

## Laatu ja hyväksyminen

Priority 1: `QS-026`. Duplicate acceptance reward = 0; exact PPM; deterministic policy/hash/Q/V; outcome-aware reward; hard authorization; bounded retry/escalate; absorbing policy; strict legacy absence; restart/idempotenssi; protected desktop/narrow UI; kaikki repository-portit vihreinä.

## Avoin kysymys

Tuotantokaltainen end-to-end-pilotti puuttuu ja jää eksplisiittisesti myöhempään ihmisvaltuutettuun Runiin.
