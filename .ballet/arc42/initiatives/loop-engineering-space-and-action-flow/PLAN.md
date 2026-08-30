---
id: lesaf-plan-001
title: Loop Engineering space and Action flow plan
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-30'
version: 6
tags: [arc42, initiative, plan, loop-engineering]
---

# Loop Engineering space and Action flow PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LESAF-step-001 | goal-023/REQ-023 | QS-033 | adr-036/CON-016 | BB-016 | RT-029 | pure State/Action and Action-flow projections | deterministic order/geometry tests | LESAF-evid-001 |
| LESAF-step-002 | goal-023/REQ-023 | QS-033 | adr-035,adr-036/CON-016 | BB-016 | RT-029 | shared canvas shell, Environment/State/Action editors and canonical routing | component/routing tests | LESAF-evid-002 |
| LESAF-step-003 | goal-023/REQ-023 | QS-033 | adr-036/CON-016 | BB-016 | DEP-006 | token-driven styles and responsive overflow boundary | 1440x900/390x844 browser QA | LESAF-evid-003 |
| LESAF-step-004 | goal-023/REQ-023 | QS-033 | adr-034–036/CON-016 | BB-016 | RT-029/DEP-006 | canonical docs, full repository and packaged startup | full gates, make latest, startup | LESAF-evid-004 |
| LESAF-step-005 | goal-023/REQ-023 | QS-033 | adr-036,adr-042/CON-016 | BB-016 | RT-029/DEP-006 | compact Action authoring, centered edge anchors and State-owned Action deletion | component/geometry/keyboard tests, desktop/narrow QA and full gates | LESAF-evid-005 |
| LESAF-step-006 | goal-023/REQ-023 | QS-033 | adr-036,adr-042/CON-016 | BB-016 | RT-029/DEP-006 | Sol/Terra/Luna-only agent authoring, combined Action model/reasoning card and status-header removal with SSE retained | pure/component/keyboard/SSE tests, desktop/narrow QA and full gates | LESAF-evid-006 |
| LESAF-step-007 | goal-023/REQ-023 | QS-033 | adr-036,adr-042/CON-016 | BB-016 | DEP-006 | compact dot-free Action reasoning rail and single-border planet presentation | component test, desktop/narrow visual QA and frontend gates | LESAF-evid-007 |
| LESAF-step-008 | goal-023/REQ-023 | QS-033 | adr-043/CON-016 | BB-016 | RT-029/DEP-006 | compact horizontal State row, selected-State vertical Action column and boundary-anchored edges | deterministic geometry/component tests, 1440×900 no-scroll and 390×844 overflow QA, full gates | LESAF-evid-008 |
| LESAF-step-009 | goal-023/REQ-023 | QS-033 | adr-043,adr-042/CON-016 | BB-016 | RT-029/DEP-006 | centered floating canvas edges, right-side Action IDs, single-border State selection and one-row model/reasoning control | geometry/component/keyboard tests, desktop/narrow element alignment QA and full gates | LESAF-evid-009 |

Työjärjestys on projection -> renderer/shell -> responsive QA -> canonical documentation/full gates. Data migrationia tai legacy-polkuja ei ole, koska domain-sopimukset eivät muutu. Palautus on scoped frontend/docs-diffin revert; se ei vaadi config- tai SQLite-rollbackia.

Riskit ovat canonical määrät ylittävän State-rivin leveys tai Action-sarakkeen korkeus, artworkin sekoittuminen runtime-statukseen ja workflow'n controller-semanttiikan vääristyminen. Testit lukitsevat order/priorityn, 44 px hitboxit, measured-surface fallbackin, maxRetries 0 -polun, canonical navigationin ja flow-edge-topologian; tekstilabelit erottavat authoring-projektion runtime controlista.

Suunnitelma ei valtuuta mergeä, pushia, releasea tai deployta.
