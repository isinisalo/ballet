---
id: lesaf-plan-001
title: Loop Engineering space and Action flow plan
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-30'
version: 2
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

Työjärjestys on projection -> renderer/shell -> responsive QA -> canonical documentation/full gates. Data migrationia tai legacy-polkuja ei ole, koska domain-sopimukset eivät muutu. Palautus on scoped frontend/docs-diffin revert; se ei vaadi config- tai SQLite-rollbackia.

Riskit ovat pitkän Action-jonon leveys, artworkin sekoittuminen runtime-statukseen ja workflow'n controller-semanttiikan vääristyminen. Testit lukitsevat order/priorityn, maxRetries 0 -polun, canonical navigationin ja flow-edge-topologian; tekstilabelit erottavat authoring-projektion runtime controlista.

Suunnitelma ei valtuuta mergeä, pushia, releasea tai deployta.
