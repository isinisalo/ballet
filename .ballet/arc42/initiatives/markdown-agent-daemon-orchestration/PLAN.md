---
id: mado-plan-001
title: Markdown Agent daemon orchestration plan
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [arc42, initiative, plan]
---

# Markdown Agent daemon orchestration PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MADO-step-001 | goal-023/REQ-023 | QS-033–037 | adr-035/CON-016 | BB-016 | DEP-006 | architecture and target contract | docs/design validation | MADO-evid-001 |
| MADO-step-002 | goal-023/REQ-023 | QS-033,035,037 | adr-035/CON-016 | BB-003,016 | RT-029 | v21 domain, Markdown Agents and project repositories | schema/property/resource tests | EVID-033/035/037 |
| MADO-step-003 | goal-023/REQ-023 | QS-034,035,037 | adr-035/CON-016 | BB-005,006,016 | RT-030/DEP-006 | SQLite v17, paired daemon, bindings, claim/lease/fencing, CLI adapters | transaction/restart/security tests | EVID-034/035/037 |
| MADO-step-004 | goal-023/REQ-023 | QS-036,037 | adr-035/CON-016 | BB-002,005,016 | RT-031 | Feedback/Refinement v2 and Run Evidence | strict HTTP, allowlist and finalization tests | EVID-036/037 |
| MADO-step-005 | goal-023/REQ-023 | QS-033–037 | adr-035/CON-016 | BB-001,016 | RT-029–031/DEP-006 | canonical API/UI and strict removal | component/browser/removal/full gates | EVID-033–037 |

## Ordering, rollback and risks

Architecture is committed first. Implementation then lands as a strict version cut; no old and new canonical path runs concurrently. Rollback is checkout of the pre-cut commit or abandoning the feature branch, never a DB down-migration. Principal risks are daemon impersonation/replay, mixed checkout truth, dropped Markdown fields, unsafe Refinement path expansion, duplicate finalization and Environment runtime regression.

## Final gates

`npm run validate:arc42`, `npx @google/design.md lint DESIGN.md`, strict version/removal checks, focused and full tests, lint, build, desktop/narrow browser QA, `git diff --check`, `make latest`, packaged startup, paired daemon status and both CLI adapter preflights. Done means every priority-1 criterion has evidence, not compilation alone.
