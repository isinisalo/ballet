---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-23'
version: 19
tags:
  - yhteenveto
  - tavoitteet
---

# Ballet-projektin yhteenveto

> **Ballet on yhden Git-checkoutin paikallinen komentokeskus, jossa global Reward-MDP valitsee GraphNoden, sen local Reward-MDP valitsee ActionNoden ja immutable runtime todentaa toteutuneen työn.**

![Balletin projektikartta](./ballet-project-map.png)

## Käyttäjäarvo

Ballet erottaa project intention, deterministic policyn ja toteutuneen execution truthin. Jokainen Root Run sidotaan Git-HEADiin, strict project configiin, authorization- ja acceptance-snapshoteihin sekä kerran compiled policyyn. Provider tuottaa Work/Validation-tuloksen; se ei valitse seuraavaa GraphNodea eikä anna numeerista progressia.

## Aktiivinen tuote

1. Repositoryssä authoroidaan Goalit, ADR:t, arc42, global 5×5 ja GraphNode-local N×N Reward Decision Modelit, nodet, Work/Validation, ExecutionProfilet, instructionit ja skillit.
2. GraphNode ja ActionNode ovat oman scopensa state/action-ID:itä; terminalit eivät lisää matriisirivejä.
3. Validation-evidenssi verify/invalidate-päivittää acceptance-ledgeriä; duplicate verification ei tuota uutta progress-rewardia.
4. Hard authorization poistaa actionin `A(s)`:stä. External write tarvitsee erillisen täsmällisen ihmisvaltuutuksen.
5. Runtime tekee global→local→Action→local→global-lookupit ja soveltaa bounded `retry | escalate` -semantiikkaa.
6. UI näyttää 5×5/N×N Q(s,a)-matriisin, reward/cost/estimate-värit, exact detailin ja erillisen acceptance-gaten. Protected Action Node flow säilyy.

## Strict implementation cut

Project Config v19; Decision Model v4; Graph Node Module v7; Root Snapshot v12; Task Envelope/Outcome v9; composition v10; ExecutionSpec v11; policy decision/observation v5; SQLite v15. Aktiivisia agent-router-, Repair-, shadow/promotion- tai compatibility-polkuja ei ole.

Default project data sisältää viisi GraphNodea, 17 ActionNodea, global 15/25 ja local yhteensä 84 authoroitua solua. Graph Node Library sisältää 14 v7-pakettia, jotka kantavat local policyn mutta eivät peer-matriisia tai acceptance-binding/effectejä.

## Päätöshistoria

`goal-021` ja `adr-033` ovat aktiiviset. Goal 020 sekä ADR-031/032 ovat superseded single-policy/ledger-state/array-order/62-landscape-osiltaan; historia säilyy audit trailina.

## Todentamatta

- Tuotantokaltainen viiden GraphNoden Reward-MDP Root Run -pilotti.
- Pinned tracker/provider live-smoke siltä osin kuin ulkoinen prerequisite puuttuu.
- Ihmisen lopullinen visual review desktop/narrow-pinnasta.

Tekninen acceptance ei muuta näitä automaattisesti suoritetuksi eikä valtuuta releasea, deployta, mergeä tai pushia.

## Kanoninen lukujärjestys

1. [ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [goal-021](goal-021-hierarchical-reward-mdp.md)
3. [adr-033](../adr/adr-033-hierarchical-node-owned-reward-mdp.md)
4. [arc42-indeksi](../arc42/README.md) ja [TRACEABILITY](../arc42/TRACEABILITY.md)
5. [Hierarchical Reward-MDP initiative](../arc42/initiatives/hierarchical-reward-mdp/BRIEF.md)
