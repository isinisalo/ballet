---
id: hierarchical-reward-mdp-plan
title: Hierarchical Reward-MDP initiative plan
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - plan
---

# Hierarchical Reward-MDP PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT | Muutos | Todennus |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HRM-step-001 | goal-021 / REQ-021 | QS-027 | adr-033 / CON-014 | BB-003, BB-014 | RT-025 | Strict v19/v4/v7/v12/v5/v15, node-derived sparse scope models ja v18 legacy-poisto. | Schema/compiler/default-data-testit ja legacy-haku. |
| HRM-step-002 | goal-021 / REQ-021 | QS-027 | adr-033 / CON-014 | BB-004, BB-005, BB-014 | RT-022, RT-023, RT-025 | Compile global/reachable-local kerran; suorita global→local→Action→local→global ja exact ledger-portti. | Runtime reward/retry/backtrack/mismatch/restart/limit-testit. |
| HRM-step-003 | goal-010, goal-021 / REQ-010, REQ-021 | QS-009, QS-027 | adr-033 / CON-007 | BB-003, BB-009 | RT-024 | Module v7 local policy; add/rename/delete atomic references ja incomplete Run-lock. | 14 package roundtrip/hash + CRUD/+10 node -testit. |
| HRM-step-004 | goal-018, goal-021 / REQ-018, REQ-021 | QS-024, QS-027 | adr-033 / CON-005, CON-014 | BB-001 | RT-025 | Global 5×5 / local N×N CSS-grid, inspector, zoom, human values, virtualization ja a11y. | Frontend-fixturet, lint/build ja desktop/narrow QA. |
| HRM-step-005 | goal-009, goal-021 / REQ-009, REQ-021 | QS-005, QS-027 | adr-011, adr-033 | BB-008 | RT-025 | Goal/ADR/arc42/DESIGN/AGENTS/README/module-rajan source-of-truth-ketju. | `validate:arc42`, DESIGN lint ja conformance search. |
| HRM-step-006 | goal-021 / REQ-021 | QS-027 | adr-033 / CON-014 | kaikki | RT-025 | Full repository gates, packaged install ja startup/health smoke. | TEST-027 / EVID-027; pilot pending. |

Hard cutissa ei ole rollback-readeria. Muutos on local/repository-sisäinen eikä valtuuta ulkoista kirjoitusta.
