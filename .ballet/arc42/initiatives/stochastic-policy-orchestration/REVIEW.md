---
id: stochastic-policy-orchestration-review
title: Stochastic Policy Orchestration REVIEW
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 2
tags:
  - arc42
  - initiative
  - review
  - ssp
---

# Stochastic Policy Orchestration REVIEW

## Nykyinen verdict

Architecture-only-design on valmis katselmoitavaksi, mutta initiative on `needs_input`. `goal-016`, `adr-026` ja `QS-021` ovat draft/pending, runtime-koodia ei ole toteutettu eikä accepted `adr-023`:n Graph-agenttirouting-rajaa ole muutettu.

## QS-verdict

| QS | Kriteeri | Evidenssi | Tila |
| --- | --- | --- | --- |
| QS-021 | Generic finite Decision State/Option/admissibility/model/solver/snapshot/persistence/projection toimii arbitrary GraphNodeilla fail-closedisti ja ilman probability mutationia. | SPO-EVID-000–006 / EVID-021 | architecture defined; human approval and implementation evidence pending |

## Faktat, oletukset, löydökset ja päätökset

- **Fakta SPO-REV-F-001:** nykyinen accepted runtime on strict-v14 scoped LLM routing, ja tämä diffi muuttaa vain architecture/project documentationia.
- **Fakta SPO-REV-F-002:** proposed design säilyttää GraphNode user-defined -rajan, GraphNode/Job hierarchyyn, Work→Validation/retryn, repair-returnin, snapshot/worktree/State/tracker-rajat ja protected canvas contractin.
- **Fakta SPO-REV-F-003:** SPO-EVID-ARCH-001/002 läpäisivät architecture validationin, coupling/diff-auditin sekä required build/install/restart/status-gaten; tämä ei ole TEST-021 implementation evidence.
- **Oletus SPO-A-001:** project owner voi toimittaa explicit calibrated priors/costit; tämä on todentamatta.
- **Hypoteesi SPO-H-001:** SSP-policy parantaa routingin inspectabilityä; tämä on todentamatta.
- **Löydös SPO-FIND-002:** LLM classifier ei ole tarpeen ensimmäisessä implementation slicessä. Canonical runtime/State/authorization featuret pitävät provider-task-contractit ennallaan ja pienentävät strict cutia.
- **Päätös:** implementation-, acceptance-, release-, deploy-, merge- tai push-valtuutusta ei ole.

## Avoimet kysymykset

SPO-OQ-001–004 vaativat projektin omistajan päätöksen. Lisäksi ensimmäisen pilotin domain expert omistaa probability/cost-calibrationin ja dokumentoi jokaisen feature-abstraktion tunnetun Markov-gap/model uncertainty -kohdan.

## Handoff

- Initiative: `stochastic-policy-orchestration`.
- Status: `draft / needs_input`.
- Valmis Node goal: architecture inspection ja implementation-ready draft design.
- Muuttuneet stable ID:t: `goal-016`, `REQ-016`, `QS-021`, `adr-026`, `CON-012`, `BB-011`, `RT-016`, `RISK-018`, `TEST-021`, `EVID-021`.
- Seuraava yksi hyväksytty toimi: projektin omistaja reviewaa ja ratkaisee SPO-OQ-001–004; sen jälkeen initiative joko hyväksytään implementation planningiin tai palautetaan architecture repairiin.
- Stop condition: koodimuutos tai ulkoinen kirjoitus ilman erillistä valtuutusta.
