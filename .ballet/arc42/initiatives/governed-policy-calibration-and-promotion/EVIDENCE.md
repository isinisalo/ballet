---
id: governed-policy-calibration-and-promotion-evidence
title: Governed Policy Calibration and Promotion EVIDENCE
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - evidence
  - calibration
---

# Governed Policy Calibration and Promotion EVIDENCE

## Evidence records

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| GPCP-EVID-001 | REQ-019 / QS-025 | Governance baseline, decision-chain validation, package build and installed startup | `goal-019`, `adr-030`, `REQ-019`, `QS-025`, `BB-012`, `RT-019`, `TEST-025`, `EVID-025`; `npm run validate:arc42`; `git diff --check`; `make latest` | passed locally | 2026-08-23; 12 sections / 80 document IDs; archive SHA-256 `acd7e6be89753a2177af0b2e816d4785178e8a07b43cbe1d359e28e89eb4cf87`; installed health OK at port 53321 with SQLite v13 | Proves document/package/startup consistency only; no calibration runtime behavior, pilot, activation or approval. |
| GPCP-EVID-002 | QS-023 / QS-025 | Complete option-cost observation and hierarchy-safe attribution | `OptionCostEvidence.test.ts`, `PolicyRuntimeIntegration.test.ts`, `LocalDatabase.test.ts`, `runPolicyViews.test.tsx`, strict v17/v10/v13 build | verified locally | 2026-08-23; focused 4 files / 11 tests; full 50 files / 191 tests; production and packaged builds passed; lint 0 errors / 15 baseline warnings; DESIGN lint 0 errors / 0 warnings | Provider monetary/utility values remain explicitly unknown when their adapters or project policy do not report/configure them. |
| GPCP-EVID-003 | QS-025 | Deterministic dataset snapshot, joint calibration, candidate registry and lineage | calibration/registry tests and candidate review report | pending | future implementation | Expert priors and thresholds are absent. |
| GPCP-EVID-004 | QS-022 / QS-025 | Exact/simulated/held-out/sensitivity evaluation and fail-closed thresholds | evaluation tests and immutable report | pending | future implementation | No candidate exists. |
| GPCP-EVID-005 | QS-023 / QS-025 | Controller/shadow separation and zero counterfactual observations | shadow runtime/persistence/read-model tests | pending | future implementation | Shadow mode does not exist. |
| GPCP-EVID-006 | QS-022 / QS-023 / QS-025 | Authorized hermetic five-GraphNode pilot and restart/resume evidence | exact pilot authorization, Root Run and retained failures | pending | future human gate | Pilot inputs and authorization are absent. |
| GPCP-EVID-007 | QS-025 | Proposal, human activation, future-run snapshot and rollback | promotion/activation/rollback audit | pending | future human gate | Live-model mutation is not authorized. |

## Current finding

Phase 2 is implemented as `PolicyOptionObservationV3` on Project Config v17, Root Snapshot v10 and SQLite v13. Each duration, token-usage, retry, repair, monetary and utility dimension is measured or explicitly unknown with source references. Local JobNode and global GraphNode observations are both inclusive, and global observations link local child observation IDs instead of summing the two scope totals. Phases 3–7 are not implemented.

## Open questions

Phase 3 requires approved project-local expert priors, scalarization, sample-readiness and coverage thresholds before a candidate can be generated.

## Next review basis

Record only actually executed checks and artifacts. Keep every future evidence row pending until its named behavior is observed.
