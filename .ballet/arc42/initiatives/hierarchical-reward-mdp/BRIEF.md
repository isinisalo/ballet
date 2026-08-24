---
id: hierarchical-reward-mdp-brief
title: Hierarchical Reward-MDP initiative brief
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - reward-mdp
---

# Hierarchical Reward-MDP BRIEF

## Tarkoitus ja päätös

Toteuta projektin omistajan hyväksymä `goal-021` / `REQ-021`: Graphin GraphNode-valinta on 5×5 node-ID Reward-MDP ja jokaisen GraphNoden ActionNode-valinta oma N×N Reward-MDP. Acceptance-ledger on erillinen Graph-evidenssiportti eikä policy-state-avaruus.

## Fakta lähtötilasta

Strict-v18 yhdisti viisi GraphNodea 62 ledger-derived stateen, visualisoi ne yhtenä landscape-pintana ja suoritti ActionNodet array-järjestyksessä. PLANin kaksi ActionNodea eivät muodostaneet näkyvää 2×2-policyä ja noden lisäämisen suhde ledgeriin oli käyttäjälle epäselvä.

## Scope

Strict contract/persistence hard cut, global/local compilerit ja immutable snapshot, hierarchical runtime + exact acceptance-portti, v7 modules/CRUD, 5×5/N×N UI, default project data, ADR/arc42/DESIGN/AGENTS/README ja final gates.

## Ei kuulu scopeen

Online learning, vapaa state-katalogi, terminal-rivit, automaattinen ledger-obligaatio, compatibility reader/migration, production-like pilot tai external write.

## Laatu ja hyväksyminen

Priority 1 on `QS-027`. Mitat ovat TEST-027:n exact contract/compiler/reward/runtime/CRUD/module/UI/final-gate-matriisi. Puuttuva production-like pilot ja ihmisvisual verdict pysyvät eksplisiittisesti erillisinä.

## Ihmispäätös ja avoin kysymys

Projektin omistaja hyväksyi suunnitelman ja toteutuspyynnön 2026-08-23. Sama pyyntö ei valtuuta releaseä/deployta/mergeä/pushia. Operatiivisen pilotin budjetti ja hyväksymismitat ovat myöhempi päätös.
