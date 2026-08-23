---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 32
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tila

- `goal-020` ja `adr-031` ovat accepted käyttäjän 2026-08-23 toteutuspyynnöllä.
- Aktiivinen control owner on yksi Graph-tason discounted Reward-MDP. GraphNode-optionit suorittavat ordered Action Nodet; Validation FAIL on bounded `retry | escalate`.
- Acceptance-ledger, authorization ja compiled policy ovat erillisiä immutable Root Snapshot v11 -osia. Runtime ei laske policya uudelleen eikä opi transitioneita.
- Reward/PPM-arvot ovat integer fixed-point -arvoja. Default-priori on exact symmetric `default_prior`, ei kalibroitu väite.
- Strict cut on Project Config v18, Decision Model v3, Module v6, Snapshot v11, Task/Outcome v9, composition v10, ExecutionSpec v11, observation v4 ja SQLite v14.
- Scoped orchestrator/local policy/Repair/router persistence/shadow/promotion ja compatibility-polut on poistettu aktiivisesta domainista.
- Default project data sisältää 5 GraphNodea ja 17 ordered Action Nodea. Platform/project-raja säilyy; release/deploy/arc42-menettely on project-local dataa.
- Protected Action Node industrial flow säilyy, mutta local Decision Model & Repair UI on poistettu. Graph Decision Model näyttää factual reward-/probability-/Q/V-/acceptance-tiedon.

## Evidenssitila

| Kohde | Nykytila |
| --- | --- |
| Strict contract/domain/compiler/runtime/UI implementation | toteutettu työpuussa |
| TypeScript ja lint ilman varoituksia | passed 2026-08-23 |
| Reward/compiler/auth/runtime focused tests | passed 2026-08-23 |
| Full repository gates | passed GRM-evid-004 |
| Tuotantokaltainen Reward-MDP-pilotti | not run; GRM-evid-005 pending |
| External writes | ei valtuutettu |

## Relevantit päätökset

`goal-020`, `adr-011`, `adr-015`, `adr-016`, `adr-025`, `adr-027`, `adr-029` säilyvin osin ja `adr-031`. Goals 016/017/019 sekä ADR:t 026/028/030 ovat superseded; ADR-023:n routing/Repair ja ADR-029:n local-policy/Repair eivät ole aktiivisia.

## Kanoniset lähteet

[ARCHITECTURE](../../ARCHITECTURE.md), [TRACEABILITY](TRACEABILITY.md), [METHOD-HEALTH](METHOD-HEALTH.md), [STATE-CONTRACT](STATE-CONTRACT.md) ja [Graph Reward-MDP initiative](initiatives/graph-reward-mdp/BRIEF.md).

## Avoimet riskit

- Tuotantokaltainen viiden GraphNoden pilotti ja restart kesken oikean provider-taskin puuttuvat.
- `default_prior` on tarkoituksella heikko eikä korvaa havaintoevidenssiä.
- Acceptance-state-avaruus kasvaa obligationien mukana; compilerin boundit suojaavat mutta eivät poista mallinnuskustannusta.

## Nykyinen handoff

- Initiative: `graph-reward-mdp`.
- Status: `review`.
- Seuraava yksi toimi: aja tuotantokaltainen viiden GraphNoden Reward‑MDP-pilotti vain erillisellä täsmällisellä valtuutuksella.
- Stop condition: release/deploy/rollback/merge/push tai muu external write vaatii erillisen täsmällisen ihmisvaltuutuksen.
