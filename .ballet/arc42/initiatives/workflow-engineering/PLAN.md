---
id: workflow-engineering-plan
title: Workflow Engineering hard cut plan
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-20'
version: 2
tags:
  - arc42
  - initiative
  - workflow-engineering
---

# Workflow Engineering PLAN

## Status

Draft implementation plan accepted in scope by the user's 2026-08-20 request; execution evidence remains separately evaluated.

## Steps

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workflow-engineering-step-001 | goal-013 / REQ-013 | QS-015 | adr-020 / CON-008 | BB-003, BB-009 | RT-001 | Shared v12/v2 schemas, project config and packages | schema/module/domain tests | WFE-EVID-001 |
| workflow-engineering-step-002 | goal-013 / REQ-013 | QS-003, QS-015 | adr-020 / CON-002, CON-008 | BB-004–BB-006 | RT-002, RT-003, RT-011 | Snapshot, execution contracts, Workflow engine and Orchestrator | runtime/orchestrator/state/recovery tests | WFE-EVID-002, WFE-EVID-003 |
| workflow-engineering-step-003 | goal-013 / REQ-013 | QS-012, QS-015 | adr-020 / CON-002 | BB-002, BB-004, BB-005 | RT-009 / DEP-001 | SQLite schema v8, `job_runs`, read model and fail-closed v7 boundary | persistence/restart/cancel/recovery tests | WFE-EVID-004 |
| workflow-engineering-step-004 | goal-013 / REQ-013 | QS-013, QS-015 | adr-020 / CON-005, CON-008 | BB-001, BB-002 | RT-010, RT-011 / DEP-001 | Canonical routing, Graph/Workflow UI, atomic authoring and canvas | routing/projection/editor/canvas/a11y tests | WFE-EVID-005 |
| workflow-engineering-step-005 | goal-013 / REQ-013 | QS-005, QS-009, QS-015 | adr-016, adr-019, adr-020 / CON-004, CON-006–CON-008 | BB-003, BB-008, BB-009 | RT-006, RT-007 | Project-local data, instructionit, packages, Goal/ADR/arc42/DESIGN | arc42/module/boundary/legacy gates | WFE-EVID-006, WFE-EVID-007 |
| workflow-engineering-step-006 | goal-013 / REQ-013 | QS-015 | adr-020 / CON-005 | BB-001 | DEP-001 | Desktop/narrow Workflow Engineering visual surface | human visual QA | WFE-EVID-008 |
| workflow-engineering-step-007 | goal-013 / REQ-013 | QS-015 | adr-021 / CON-005, CON-008 | BB-001 | DEP-001 | Job-only space canvas, internal Validation projection, persisted `straight | smoothstep` Edges and node-free results | canvas tests, lint/build, desktop/narrow browser QA | WFE-EVID-009 |

## Ordering and migration

1. Muuta shared contractit ja strict parserit.
2. Muunna runtime/snapshot/persistence yhtä koordinoitua versiopintaa vasten.
3. Muunna API/UI ja repository-owned config/paketit.
4. Päivitä testit, instructionit ja canonical arkkitehtuurilähteet.
5. Aja smoke/full gatet ja ihmisreview.

Repository-owned data käyttää determinististä ID-muunnosta. Runtime schema v7:ää ei migroida; operaattori arkistoi vanhan kannan virheilmoituksen täsmäohjeen mukaisesti ja käynnistää uuden v8-kannan.

## Legacy removal

Aktiivisessa koodissa tai datassa ei jää WorkLoopNode/WorkNode-mallia, Validation OK/mode-valintaa, `view=loop`-aliasta, v11/v1-readeria, role `work` -arvoa tai `work_loop_node_runs`-taulua.

## Risks

- Rakenne- ja runtime-semanttiikan osittainen cutover voisi tehdä snapshotista tai recoverysta ristiriitaisen; koordinoitu version cut ja compile/test-gatet estävät tämän.
- FailEdge ja technical failure voivat sekoittua UI:ssa; exact icon/text semantics ja erilliset testit ovat acceptance-raja.
- Deterministinen Job-only layout tai smart smoothstep -reititys voi heikentyä sykleillä tai narrow-viewportissa; geometry/keyboard/narrow-testit ja ihmisreview ovat pakollisia.

## Non-goals and authority

Suunnitelma ei valtuuta releaseä, deployta, mergeä, pushia tai vanhan tietokannan automaattista muuttamista.

## Open questions

Ei scopea muuttavaa avointa kysymystä. Visual QA:n ihmisverdict on hyväksymisen pending-evidenssi, ei toteutuksen scope-valinta.

## Next review basis

Ready for REVIEW when WFE-EVID-001–007 and WFE-EVID-009 are passed and WFE-EVID-008 has an explicit human verdict.
