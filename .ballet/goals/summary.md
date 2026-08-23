---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-23'
version: 18
tags:
  - yhteenveto
  - tavoitteet
---

# Ballet-projektin yhteenveto

> **Ballet on yhden Git-checkoutin paikallinen komentokeskus, jolla versionhallittu Reward-MDP valitsee AI-kehityskulun seuraavan GraphNode-optionin ja immutable runtime todentaa toteutuneen työn.**

![Balletin projektikartta](./ballet-project-map.png)

## Käyttäjäarvo

Ballet erottaa project intention, deterministic policyn ja toteutuneen execution truthin. Jokainen Root Run sidotaan Git-HEADiin, strict project configiin, authorization- ja acceptance-snapshoteihin sekä kerran compiled policyyn. Provider tuottaa Work/Validation-tuloksen; se ei valitse seuraavaa GraphNodea eikä anna numeerista progressia.

## Aktiivinen tuote

1. Repositoryssä authoroidaan Goalit, ADR:t, arc42, Graph-tason Reward Decision Model, GraphNodet, ordered Action Nodet, Work/Validation, ExecutionProfilet, instructionit ja skillit.
2. GraphNode on MDP-action-optio. Policy optimoi aidosti, koska default Graphin reachable action-setissä on useita valintoja.
3. Validation-evidenssi verify/invalidate-päivittää acceptance-ledgeriä; duplicate verification ei tuota uutta progress-rewardia.
4. Hard authorization poistaa actionin `A(s)`:stä. External write tarvitsee erillisen täsmällisen ihmisvaltuutuksen.
5. Runtime tekee immutable compiled policy -lookupin, suorittaa Action Nodet järjestyksessä ja soveltaa bounded `retry | escalate` -semantiikkaa.
6. UI näyttää Reward-erittelyn, γ:n, exact PPM:t, prior-provenienssin, acceptance-progressin sekä Q/V/policyn. Protected Action Node flow säilyy.

## Strict implementation cut

Project Config v18; Decision Model v3; Graph Node Module v6; Root Snapshot v11; Task Envelope/Outcome v9; composition v10; ExecutionSpec v11; policy observation v4; SQLite v14. Aktiivisia agent-router-, local-policy-, Repair-, shadow/promotion- tai compatibility-polkuja ei ole.

Default project data sisältää viisi project-local GraphNodea ja 17 ordered Action Nodea. Platform ei tunne niiden nimiä tai arc42-/release-menettelyä. Graph Node Library sisältää 14 v6-pakettia, jotka materialisoituvat project-local-resursseiksi eivätkä kanna local policya tai Repair-resursseja.

## Päätöshistoria

Goalit 016/017/019 ja ADR:t 026/028/030 ovat superseded. ADR-031 supersedoi myös ADR-023:n scoped routing/Repair- ja ADR-029:n local-policy/Repair-osat. Historia säilyy audit trailina; aktiivinen WHAT/WHY on `goal-020` ja aktiivinen ratkaisu `adr-031`.

## Todentamatta

- Tuotantokaltainen viiden GraphNoden Reward-MDP Root Run -pilotti.
- Pinned tracker/provider live-smoke siltä osin kuin ulkoinen prerequisite puuttuu.
- Ihmisen lopullinen visual review desktop/narrow-pinnasta.

Tekninen acceptance ei muuta näitä automaattisesti suoritetuksi eikä valtuuta releasea, deployta, mergeä tai pushia.

## Kanoninen lukujärjestys

1. [ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [goal-020](goal-020-graph-reward-mdp.md)
3. [adr-031](../adr/adr-031-single-graph-reward-mdp.md)
4. [arc42-indeksi](../arc42/README.md) ja [TRACEABILITY](../arc42/TRACEABILITY.md)
5. [Reward-MDP initiative](../arc42/initiatives/graph-reward-mdp/BRIEF.md)
