---
id: graph-reward-mdp-plan
title: Graph Reward-MDP initiative plan
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - plan
---

# Graph Reward-MDP PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT | Muutos | Todennus |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GRM-step-001 | goal-020 / REQ-020 | QS-026 | adr-031 / CON-013 | BB-003, BB-013 | RT-020 | Strict v18/v3/v6/v11/v9/v10/v11/v4/v14 ja legacy-poisto. | Schema-, boundary- ja absence-testit. |
| GRM-step-002 | goal-020 / REQ-020 | QS-026 | adr-031 / CON-013 | BB-013 | RT-020 | Reward compiler, ledger, authorization, absorption ja stable policy snapshot. | Determinismi-, reward-, authorization- ja compiler-testit. |
| GRM-step-003 | goal-020 / REQ-020 | QS-026 | adr-031 / CON-002 | BB-005, BB-013 | RT-020 | Ordered Work→Validation, bounded retry/escalate ja persistence. | Hermetic DONE, restart/idempotenssi ja retryrajat. |
| GRM-step-004 | goal-020 / REQ-020 | QS-024, QS-026 | adr-029, adr-031, adr-032 | BB-001 | RT-018 | Näytä factual Reward-MDP visuaalisena pulse/horizon/transition-impact/relative V -tilannekuvana; ihmisyksiköt exact-detailillä ja transition-mallittomat GraphNodet näkyvästi. | Frontend-testit, primary form/table -absence, lint/build ja desktop/narrow QA. |
| GRM-step-005 | goal-020 / REQ-020 | QS-005, QS-026 | adr-011, adr-031 | BB-008 | RT-020 | Kanoninen Goal/ADR/arc42/initiative-ketju. | `validate:arc42`, linkit ja trace. |
| GRM-step-006 | goal-020 / REQ-020 | QS-026 | adr-031 / CON-013 | kaikki | RT-020 | Adversarial conformance ja final gates. | TEST-026 / EVID-026; puuttuva pilotti jää pending. |

Strict hard cutissa ei ole rollback-readeria: ennen tuotantoa oleva tyhjä v13-kanta korvataan v14-kannalla. Suoritusjärjestys on 001→006; yksikään vaihe ei valtuuta external writea.
