---
id: outcome-aware-hierarchical-policy-evidence
title: Outcome-aware Hierarchical Policy EVIDENCE
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - evidence
  - ssp
---

# Outcome-aware Hierarchical Policy EVIDENCE

## Evidence index

| ID | Claim | Evidence | Status |
| --- | --- | --- | --- |
| OHP-EVID-001 | Config v16 accepts agent drafts and fail-closes invalid/improper global or local `ssp_v2`. | `backend/tests/projectConfigV16*.test.ts`, compiler/solver tests | verified locally |
| OHP-EVID-002 | Outcome/state observations use projector-owned actual state and classify all model misses without prior mutation. | `backend/policy/PolicyRuntimeIntegration.test.ts`, projector tests | verified locally |
| OHP-EVID-003 | Most Likely Rollout uses full cumulative trajectory probability, including `0.6×0.5 < 0.4×1.0`. | `backend/policy/PolicyProjection.test.ts` | verified locally |
| OHP-EVID-004 | Snapshot v9, SQLite v12 and Module v5 preserve scoped model/outcome/module provenance. | snapshot/storage/module suites | verified locally |
| OHP-EVID-005 | Full repository, packaged module and startup gates. | final command results | passed locally |
| OHP-EVID-006 | Calibrated five-GraphNode end-to-end pilot and restart/resume evidence. | Root Run evidence and owner review | pending human calibration/pilot |

## Current local result

The implementation test suite passed 49 files / 189 tests after removal of the obsolete upper-level planet canvas. The focused final Job-flow regression passed 3 files / 11 tests. `npm run validate:arc42`, `npm run lint` (0 errors, 15 non-blocking size/complexity warnings), `npm run build`, DESIGN lint (0 errors / 0 warnings), Module v5 inspect/plan/install/export/remove smoke, platform-boundary search and `git diff --check` passed locally. `make latest` passed after upgrading its fixture from strict v15/Module v4/SQLite v11 to v16/v5/v12; final archive SHA-256 is `6333ba148e00f7327aa3d557acd781eae984f949f7bf17ccd481fe3f41f8a8bb`. Installed Ballet restarted healthy at `http://127.0.0.1:53321` with SQLite v12.

This is implementation/startup evidence, not pilot evidence. The lint warning baseline increased from the previously documented 8 to 15 and remains a clean-code follow-up even though the lint gate exits successfully.

## Missing evidence

Approved outcome catalogs, priors and costs; one successful complete Graph Run; empirical latency/cost/retry/model-miss/completion measures; explicit Portti B approval.
