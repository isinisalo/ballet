---
id: arc42-initiative-loop-engineer-three-level-canvas-plan
title: Loop Engineer three-level canvas PLAN
status: draft
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 2
tags:
  - arc42
  - initiative
  - loop-engineer
---

# Loop Engineer three-level canvas PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| loop-engineer-step-001 | goal-011 / REQ-011 | QS-010 | adr-017 / CON-005 | BB-001 | — | typed routing and route generators | routing/history tests | LEC-EVID-001 |
| loop-engineer-step-002 | goal-011 / REQ-011 | QS-010 | adr-017 / CON-005 | BB-001 | — | pure Context/composition/detail projections and deterministic layouts | projection/layout unit tests | LEC-EVID-002 |
| loop-engineer-step-003 | goal-007, goal-011 / REQ-007, REQ-011 | QS-001, QS-010 | adr-017 / CON-005 | BB-001 | — | Loop Engineer shell, level navigation, Context, composition canvas/inspector and detail editor | keyboard/responsive UI tests and screenshots | LEC-EVID-003 |
| loop-engineer-step-004 | goal-010, goal-011 / REQ-010, REQ-011 | QS-009, QS-010 | adr-016, adr-017 / CON-007 | BB-001, BB-009 | RT-006 | Loop Library refresh and two software-delivery one-Loop packages | module/API/UI/smoke tests | LEC-EVID-004 |
| loop-engineer-step-005 | goal-009, goal-011 / REQ-009, REQ-011 | QS-005, QS-010 | adr-011, adr-017 / CON-006 | BB-001, BB-008 | — | DESIGN, building-block whitebox, trace, status and initiative evidence | arc42/design validation and conformance review | LEC-EVID-005 |

## Ordering and compatibility

Decisions precede typed routing; pure projections precede UI composition; Level 1 ownership moves before Level 2 removes project-global controls. Starter packages use the existing V1 package contract. The hard cut removes `view=all` and the card-grid implementation without changing strict-v10 persisted data.

## Failure and rollback implications

Frontend selection and level changes remain non-persisted. Draft mutation still saves explicitly through the existing automation endpoint. Module install remains config-last and publishes workspace invalidation; the UI also awaits authoritative refresh before selecting the installed Loop.

## Risks

- Level semantics could leak through reuse of the old composite cross-Loop layout.
- React Flow keyboard focus could be lost if interactive Loop nodes remain wrapper-level only.
- A successful install could remain absent from a stale local draft.
- Dense inspectors could overflow narrow viewports.

These are controlled by separate pure projections, an explicit Level 1 node button, selected-Loop-only detail layout, awaited workspace refresh, mobile Sheet behavior and browser screenshots.

## Checks

`npm run validate:arc42`, `npm run test`, focused module/API/UI tests, `npm run lint`, `npm run build`, `npx @google/design.md lint DESIGN.md`, platform-boundary grep, packaged release smoke where applicable, browser verification at 1440×900 and 390×844, and `git diff --check`.

## Open questions

None in scope. The plan grants no release, deploy, merge or push authority.

## Completion status

Steps `loop-engineer-step-001`–`loop-engineer-step-005` are implemented and evidenced by LEC-EVID-001–LEC-EVID-005. REVIEW.md records the bounded `APPROVED_WITH_NOTES` conformance verdict.
