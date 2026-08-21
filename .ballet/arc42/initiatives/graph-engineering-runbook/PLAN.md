---
id: graph-engineering-runbook-plan
title: Graph Engineering RunBook initiative plan
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-20'
version: 1
tags:
  - arc42
  - initiative
  - graph-engineering
  - runbook
---

# Graph Engineering RunBook PLAN

## Tarkoitus ja tila

Tämä on `goal-014` / `adr-022` -muutoksen rajattu implementation plan. `draft`; toteutus on käynnissä eikä tämä tiedosto anna deploy-, release-, merge- tai push-valtuutusta.

## Toteutusketju

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GER-step-001 | goal-014 / REQ-014 | QS-016 | adr-022 / CON-009 | BB-003–BB-006 | RT-012 | Strict v13 Graph, v6 snapshot/envelope/outcome, v7/v8 composition/execution, DB v9 | schema/version/18-transition/limit/root-kind tests | GER-EVID-001 |
| GER-step-002 | goal-014 / REQ-014 | QS-018 | adr-022 / CON-010 | BB-004, BB-005, BB-010 | RT-013 / DEP-004 | `TkTracker`, tracker outbox/link tables, reconciliation, local settings ja `ballet tracker` | hermetic fake-CLI fault matrix ja optional live smoke | GER-EVID-002 |
| GER-step-003 | goal-014 / REQ-014 | QS-016, QS-018 | adr-022 / CON-009, CON-010 | BB-003, BB-008, BB-009 | RT-012, RT-013 / DEP-004 | viisi Loopia, 18 transitionia, Story/Release Map, instructions ja GraphEngineeringStateV1 | config/arc42/resource/platform-boundary validation | GER-EVID-003 |
| GER-step-004 | goal-014 / REQ-014 | QS-016 | adr-022 / CON-007, CON-009 | BB-003, BB-009 | RT-006, RT-007 | Loop Module v3, five graph-engineering packages, generic package conversion | package/install/export/API/UI/release smoke | GER-EVID-004 |
| GER-step-005 | goal-014 / REQ-014 | QS-017 | adr-021, adr-022 / CON-005 | BB-001, BB-002 | RT-010, RT-012 / DEP-001 | Graph canvas/layout/inspector/Run routes; unchanged Workflow canvas | UI unit/a11y, 1/5/40 desktop/narrow browser QA ja Workflow regression QA | GER-EVID-005 |
| GER-step-006 | goal-014 / REQ-014 | QS-016–QS-018 | adr-022 / CON-006 | BB-008 | RT-012, RT-013 / DEP-004 | Goal/ADR/arc42/STATUS/trace/handoff/README/prerequisite docs | validate:arc42, lint, build, DESIGN lint, diff check, boundary search | GER-EVID-006 |

## Järjestys ja migration

Contracts muuttuvat ensin, sitten immutable snapshot/runtime, tracker reconciliation, project-local data/modules, UI ja dokumentaatio. Kaikki repository-owned fixturet muutetaan samassa hard cutissa. Compatibility-readereita tai legacy generoituja arc42-moduleja ei säilytetä.

Runtime DB v8:aa ei migroida paikallaan. Käynnistys failaa suljetusti ja antaa archive/remediation-ohjeen ennen uuden v9-kannan luontia käyttäjän valitsemassa puhtaassa state-hakemistossa.

## Riskit ja stop-ehdot

- RISK-015: laaja cross-layer strict cut voi jättää yhden kuluttajan vanhaan sopimukseen; compile/schema/runtime/UI/boundary-matriisi estää handoffin.
- RISK-016: `tk` on ulkoinen paikallinen prerequisite; preflight/outbox/reconciliation estää etenemisen mutta live-smoke voi puuttua ympäristöstä.
- WHAT/WHY-, prioriteetti-, merkittävä ADR- tai deploy-valtuutuspuute pysäyttää `needs_input`-tilaan.

## Lopputarkistukset

`npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build`, module package/install/export/API/UI/release smoke, project-workflow identifier boundary search, `npx @google/design.md lint DESIGN.md` kun saatavilla, desktop/narrow browser-QA ja `git diff --check`.
