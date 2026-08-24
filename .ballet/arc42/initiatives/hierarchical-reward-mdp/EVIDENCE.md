---
id: hierarchical-reward-mdp-evidence
title: Hierarchical Reward-MDP initiative evidence
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - evidence
---

# Hierarchical Reward-MDP EVIDENCE

| Evidence ID | QS/requirement | Tarkistus | Artifactit | Tulos | Rajoitus |
| --- | --- | --- | --- | --- | --- |
| HRM-evid-001 | REQ-021, QS-027 | Strict v19/v4/v7/v12/v5/v15 schemas, node-ID refs, sparse cells, terminal/PPM/outcome/absorption. | `shared/`, `backend/policy/`, `.ballet/project.json` | passed | Automated/project-local evidence. |
| HRM-evid-002 | QS-027 | Global/local reward ja runtime: happy path, retry, backtrack, terminal escalation, ledger mismatch, authorization, restart/idempotenssi, out-of-contract ja 256-raja. | `backend/runtime/RuntimeFlowCoordinator.test.ts`, policy tests | passed | Ei production-like pilot. |
| HRM-evid-003 | QS-009, QS-027 | +10 GraphNodea→15×15/ledger ennallaan, atomic refs, Module v7 14 package inspect/install/export/hash/remove. | frontend CRUD tests, `.ballet/tests/projectLocalGraphNodeLibrary.test.ts` | passed | Package- ja installed-release-smoke läpäisivät. |
| HRM-evid-004 | QS-024, QS-027 | Graph 5×5, PLAN 2×2, DESIGN 12×12, semantic CSS-grid, keyboard, exact detail, reward/cost/estimate, 40/64 virtualization sekä desktop/narrow overflow-QA. | `frontend/tests/decisionModelWorkspace.test.tsx`; `evidence/decision-model-5x5-1440x900.png`; `evidence/decision-model-5x5-390x844.png`; `evidence/decision-model-plan-2x2-1440x900.png` | passed | 40/64 skaalat todennettu automated fixtureillä; selaimessa default 5/2/12. Ihmisen visual verdict erillinen. |
| HRM-evid-005 | QS-005, QS-027 | Full test/lint/build/arc42/DESIGN/module/boundary/diff/latest/startup-portit. | TEST-027 final commands | passed | 47 test fileä / 181 testiä; lint 0; DESIGN 0/0; arc42 12 osiota / 88 ID:tä; Module-smoke 10 testiä; archive SHA-256 `28bc2e4d3edec18290c4183bb0f8047dde29c16c9697bfc6bb305772017ab017`; installed health OK SQLite v15. |
| HRM-evid-006 | QS-027 | Tuotantokaltainen viiden GraphNoden hierarchical Root Run ja ihmisvisual verdict. | myöhempi Root Run / review | pending | Ei valtuutettu tässä muutoksessa. |

## Relevantit päätökset

`goal-021`, `adr-033`, `CON-014`, `BB-014`, `RT-025`. Browser-QA 1440×900: page overflow 0, Graph 15/25, Plan 3/4, Design 78/144, keyboard focus siirtyi seuraavaan mallinnettuun soluun. 390×844: page/main overflow 0, 366 px sisältöraita, matrix-scroll 364/768 px ja konsolivirheitä/varoituksia 0. Transientteja komentolokeja ei kopioida tähän.
