---
id: governed-policy-calibration-and-promotion-evidence
title: Governed Policy Calibration and Promotion EVIDENCE
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
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
| GPCP-EVID-001 | REQ-019 / QS-025 | Governance baseline, decision-chain validation, package build and installed startup | `goal-019`, `adr-030`, `REQ-019`, `QS-025`, `BB-012`, `RT-019`, `TEST-025`, `EVID-025`; `npm run validate:arc42`; `git diff --check`; `make latest` | passed locally | 2026-08-23; 12 sections / 80 document IDs; installed health OK at port 53321 | Proves document/package/startup consistency only; no calibration runtime behavior, pilot, activation or approval. |
| GPCP-EVID-002 | QS-023 / QS-025 | Complete option-cost observation and hierarchy-safe attribution | strict contract/persistence/provider/runtime tests | pending | future implementation | No observation schema change is currently authorized. |
| GPCP-EVID-003 | QS-025 | Deterministic dataset snapshot, joint calibration, candidate registry and lineage | calibration/registry tests and candidate review report | pending | future implementation | Expert priors and thresholds are absent. |
| GPCP-EVID-004 | QS-022 / QS-025 | Exact/simulated/held-out/sensitivity evaluation and fail-closed thresholds | evaluation tests and immutable report | pending | future implementation | No candidate exists. |
| GPCP-EVID-005 | QS-023 / QS-025 | Controller/shadow separation and zero counterfactual observations | shadow runtime/persistence/read-model tests | pending | future implementation | Shadow mode does not exist. |
| GPCP-EVID-006 | QS-022 / QS-023 / QS-025 | Authorized hermetic five-GraphNode pilot and restart/resume evidence | exact pilot authorization, Root Run and retained failures | pending | future human gate | Pilot inputs and authorization are absent. |
| GPCP-EVID-007 | QS-025 | Proposal, human activation, future-run snapshot and rollback | promotion/activation/rollback audit | pending | future human gate | Live-model mutation is not authorized. |

## Current finding

The repository is at Portti A. `PolicyOptionObservationV2`, `PolicyEvidenceStore`, SQLite v12 and runtime read models prove outcome/state/duration provenance. The observation producer leaves actual cost unset; token usage remains execution-event data rather than a complete option observation. Phases 2–7 are not implemented, and draft governance is not implementation evidence.

## Open questions

Project owner acceptance of `goal-019` and `adr-030` is required before GPCP-EVID-002 can begin.

## Next review basis

Record only actually executed checks and artifacts. Keep every future evidence row pending until its named behavior is observed.
