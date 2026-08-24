---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 34
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tila

- `goal-021` ja `adr-033` ovat accepted käyttäjän 2026-08-23 hierarchical 5×5/N×N -toteutuspyynnöllä.
- Graph-tason policy valitsee GraphNoden ja GraphNoden local policy ActionNoden. Validation FAIL on bounded `retry | escalate`, mutta outcome kulkee aina local branchin kautta.
- Acceptance-ledger, authorization ja compiled global/local policyt ovat erillisiä immutable Root Snapshot v12 -osia. Runtime ei laske policya uudelleen, arvo branchia eikä opi transitioneita.
- Reward/PPM-arvot ovat integer fixed-point -arvoja. Default-priori on exact symmetric `default_prior`, ei kalibroitu väite.
- Strict cut on Project Config v19, Decision Model v4, Module v7, Snapshot v12, Task/Outcome v9, composition v10, ExecutionSpec v11, decision/observation v5 ja SQLite v15.
- Scoped LLM-orchestrator/Repair/router persistence/shadow/promotion ja compatibility-polut on poistettu; node-ID local Reward-MDP on aktiivinen deterministic primitive.
- Default project data sisältää 5 GraphNodea, 17 ActionNodea, global 15/25 sekä local 78/144 DESIGN ja 3/4 PLAN -solut.
- Protected Action Node flow säilyy. Graph ja GraphNode näyttävät 5×5/N×N Q(s,a)-matriisit ihmisyksiköissä; exact micros/ppm, scope, branch ja acceptance-gate säilyvät inspectoitavina.

## Evidenssitila

| Kohde | Nykytila |
| --- | --- |
| Strict contract/domain/compiler/runtime/UI implementation | toteutettu työpuussa |
| TypeScript ja lint ilman varoituksia | passed 2026-08-23 |
| Reward/compiler/auth/runtime focused tests | passed 2026-08-23 |
| Hierarchical 5×5/N×N UI automated tests | passed HRM-evid-004 |
| Full repository + desktop/narrow gates | passed HRM-evid-005 |
| Tuotantokaltainen Reward-MDP-pilotti | not run; HRM-evid-006 pending |
| External writes | ei valtuutettu |

## Relevantit päätökset

`goal-021`, `adr-011`, `adr-015`, `adr-016`, `adr-025`, `adr-027`, `adr-029` säilyvin osin sekä `adr-033`. Goal 020 ja ADR-031/032 ovat superseded ADR-033:n nimeämiltä osilta.

## Kanoniset lähteet

[ARCHITECTURE](../../ARCHITECTURE.md), [TRACEABILITY](TRACEABILITY.md), [METHOD-HEALTH](METHOD-HEALTH.md), [STATE-CONTRACT](STATE-CONTRACT.md) ja [Hierarchical Reward-MDP initiative](initiatives/hierarchical-reward-mdp/BRIEF.md).

## Avoimet riskit

- Tuotantokaltainen viiden GraphNoden pilotti ja restart kesken oikean provider-taskin puuttuvat.
- `default_prior` on tarkoituksella heikko eikä korvaa havaintoevidenssiä.
- Sparse lower-triangle authoring estää tuleviin vaiheisiin hypyn, mutta uuden noden required cells tarvitsevat eksplisiittisen authoroinnin ennen Runia.
- Toteutetun dashboardin final project-owner pixel verdict pysyy erillään teknisestä selain-QA:sta.

## Nykyinen handoff

- Initiative: `hierarchical-reward-mdp`.
- Status: `review`; tekniset portit passed, ihmis-/pilottievidenssi pending.
- Seuraava yksi toimi: projektin omistajan visual verdict tai erikseen valtuutettu production-like hierarchical Root Run -pilotti.
- Stop condition: release/deploy/rollback/merge/push tai muu external write vaatii erillisen täsmällisen ihmisvaltuutuksen.
