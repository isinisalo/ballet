---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 35
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tila

- `goal-022` ja `adr-034` ovat accepted käyttäjän 2026-08-29 target-pyynnöllä. Ne määrittävät Environment → State → Action-, approved Use Case-, Validation-led-, Feedback/Critic/Refinement approval- ja immutable continuation/Product Snapshot -lopputilan.
- Target matrix on Project Config v20, Snapshot v13, Task/outcome v10, composition v11, ExecutionSpec v12, SQLite v16 ja Feedback/Critic/Refinement v1. Decision Model, Graph Node Module ja policy/acceptance-sopimukset poistuvat final cutissa.
- Target ei ole vielä implementoitu: `EVID-028`–`EVID-032` ovat pending. Phases 02–08 käyttävät vain dataeristettyä vNext-poikkeusta; phase 09 canonicalisoi ja poistaa sekä legacy- että vNext-pinnat.
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
| Environment target architecture/transition contract | accepted; ESAO-evid-002 passed documentation checks 2026-08-29 |
| Target implementation QS-028–QS-032 | not implemented; EVID-028–EVID-032 pending |
| External writes | ei valtuutettu |

## Relevantit päätökset

Accepted target: `goal-022`, `adr-034`. Active implementation baseline phase 09:ään asti: `goal-021`, `adr-011`, `adr-015`, `adr-016`, `adr-025`, `adr-027`, `adr-029` säilyvin osin sekä `adr-033`. Final supersession on ADR-034:n nimetty lista.

## Kanoniset lähteet

[ARCHITECTURE](../../ARCHITECTURE.md), [TRACEABILITY](TRACEABILITY.md), [METHOD-HEALTH](METHOD-HEALTH.md), [STATE-CONTRACT](STATE-CONTRACT.md), [active baseline initiative](initiatives/hierarchical-reward-mdp/BRIEF.md) ja [accepted target contract](initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md).

## Avoimet riskit

- Tuotantokaltainen viiden GraphNoden pilotti ja restart kesken oikean provider-taskin puuttuvat.
- `default_prior` on tarkoituksella heikko eikä korvaa havaintoevidenssiä.
- Sparse lower-triangle authoring estää tuleviin vaiheisiin hypyn, mutta uuden noden required cells tarvitsevat eksplisiittisen authoroinnin ennen Runia.
- Toteutetun dashboardin final project-owner pixel verdict pysyy erillään teknisestä selain-QA:sta.
- Targetin suurimmat avoimet riskit ovat namespace-eristyksen drift, partial phase 09 cut, approval replay/race, Critic artifact lifetime ja shared Skill refinement impact; `RISK-023` / Target PLAN omistavat kontrollit.

## Nykyinen handoff

- Initiative: `environment-state-action-orchestration`.
- Status: accepted architecture; active runtime remains v19; implementation pending.
- Seuraava yksi toimi: pyydä/vastaanota erillinen valtuutus phase 02 isolated Project Config v20- ja Environment/State/Action-contract-toteutukselle.
- Stop condition: phase 02+ tuotantokoodi sekä release/deploy/rollback/merge/push tai muu external write vaatii erillisen täsmällisen ihmisvaltuutuksen.
