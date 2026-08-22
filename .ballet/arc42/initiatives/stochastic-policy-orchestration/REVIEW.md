---
id: stochastic-policy-orchestration-review
title: Stochastic Policy Orchestration REVIEW
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 4
tags:
  - arc42
  - initiative
  - review
  - ssp
---

# Stochastic Policy Orchestration REVIEW

## Nykyinen verdict

Projektin omistaja hyväksyi `goal-016`:n, `adr-026`:n, `QS-021`:n ja SPO-OQ-001–004:n. Generic SSP runtime-core on toteutettu strict v15/v8/v11 -cutilla; full gate ja conformance läpäisivät. Core-slice on hyväksymiskelpoinen. 1 024-state/cross-host-evidenssi, täysi policy editor/projection, cancel-race-stressi ja tuotantokaltainen pilotti ovat seuraavan slicen avoimia rajoja.

## QS-verdict

| QS | Kriteeri | Evidenssi | Tila |
| --- | --- | --- | --- |
| QS-021 | Generic finite Decision State/Option/admissibility/model/solver/snapshot/persistence/evidence toimii arbitrary GraphNodeilla fail-closedisti ja ilman probability mutationia. | SPO-EVID-000–006 / EVID-021 | core implementation and conformance passed; full projection/benchmark/pilot pending |

## Faktat, oletukset, löydökset ja päätökset

- **Fakta SPO-REV-F-001:** nykyinen accepted runtime on strict-v15 explicit `agent_v1 | ssp_v1`; GraphNode-scope käyttää edelleen scoped agent routingia.
- **Fakta SPO-REV-F-002:** toteutus säilyttää GraphNode user-defined -rajan, GraphNode/Job hierarkian, Work→Validation/retryn, repair-returnin, snapshot/worktree/State/tracker-rajat ja protected canvas contractin.
- **Fakta SPO-REV-F-003:** TEST-021 core-matriisin full suite 186/186, build, lint 0 errorilla, arc42/DESIGN/diff-gatet, release/install/restart/status ja conformance ovat läpäisseet.
- **Löydös SPO-FIND-003:** ensimmäinen conformance-pass löysi kaksi evidence-gapia, jotka korjattiin full rename -metamorphic fixturellä ja bounded runtime/State/authorization/missing/domain-projektiotesteillä. Uusintakatselmointi löysi 0 core implementation defectiä ja 0 project GraphNode ID -branchia production platformista.
- **Oletus SPO-A-001:** project owner voi toimittaa explicit calibrated priors/costit; tämä on todentamatta.
- **Hypoteesi SPO-H-001:** SSP-policy parantaa routingin inspectabilityä; tämä on todentamatta.
- **Löydös SPO-FIND-002:** LLM classifier ei ole tarpeen ensimmäisessä implementation slicessä. Canonical runtime/State/authorization featuret pitävät provider-task-contractit ennallaan ja pienentävät strict cutia.
- **Päätös:** implementation authority saatiin core-slicelle; release-, deploy-, merge- tai push-valtuutusta ei ole.

## Avoimet kysymykset

SPO-OQ-001–004 on ratkaistu. Ensimmäisen pilotin domain expert omistaa probability/cost-calibrationin ja dokumentoi jokaisen feature-abstraktion tunnetun Markov-gap/model uncertainty -kohdan. Täysi editor/projection ja SSP cancel-race stressi tarvitsevat seuraavan rajatun slicen.

## Handoff

- Initiative: `stochastic-policy-orchestration`.
- Status: `review`; accepted architecture ja generic SSP runtime-core ovat valmiit, seuraavan slicen acceptance rajataan erikseen.
- Valmis Node goal: generic SSP runtime-core, strict cut ja paikallinen acceptance/conformance.
- Muuttuneet stable ID:t: `goal-016`, `REQ-016`, `QS-021`, `adr-026`, `CON-012`, `BB-011`, `RT-016`, `RISK-018`, `TEST-021`, `EVID-021`.
- Seuraava yksi hyväksytty toimi: rajaa editor/projection/benchmark/cancel-race/pilot erilliseen seuraavaan sliceen.
- Stop condition: release/deploy/merge/push tai muu ulkoinen kirjoitus ilman erillistä valtuutusta.
