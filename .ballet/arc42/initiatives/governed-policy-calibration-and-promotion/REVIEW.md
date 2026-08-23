---
id: governed-policy-calibration-and-promotion-review
title: Governed Policy Calibration and Promotion REVIEW
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - review
  - calibration
---

# Governed Policy Calibration and Promotion REVIEW

## Current verdict

Phase 1 governance is accepted and Phase 2 option-cost evidence is implemented. No Phase 3–7 dataset snapshot, calibration candidate, evaluation, shadow decision, pilot, activation or rollback has occurred.

## Findings

- **Fact GPCP-R-F-001:** accepted ADR-026 and ADR-028 still forbid observation-driven live-model mutation; accepted ADR-030 authorizes governed offline phases.
- **Finding GPCP-R-FIND-001:** resolved for Phase 2 by observation v3, explicit unknown semantics and hierarchy-safe inclusive attribution.
- **Decision GPCP-R-D-001:** `goal-019` and `adr-030` accepted in commit `26698dda09c9e9fda5284d4bfa578d6084581dc5`.
- **Assumption GPCP-A-001:** unresolved; exact expert priors, scalarization and thresholds are not yet authored.
- **Hypothesis GPCP-H-001:** untested; no pilot or shadow evidence exists.

## QS verdict

| QS | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| QS-025 | Immutable deterministic calibration/promotion chain and human activation | GPCP-EVID-001/002 | governance and Phase 2 observation evidence passed locally; Phases 3–7 absent |

## Conformance review

The bounded implementation preserves ADR-026/028's no-history-default, projector, proper-policy and no-fallback invariants, immutable Root Run snapshots, Work→Validation→bounded retry, Repair and human external-write gates. It changes the strict project, snapshot, policy-observation, SQLite, API and read-model contracts together without compatibility readers or dual writes.

Accepted ADR-030 explicitly reassigns ADR-028's anticipated Portti B v17/v10/v13 number reservation to the earlier Phase 2 observation cut while preserving Portti B's separate semantic approval gate. The reservation change is active; Portti B model activation is not.

Remaining limitation: `GPCP-EVID-003`–`GPCP-EVID-007` remain pending and block candidate, evaluation, pilot and activation claims.

## Handoff

- Current status: Phase 2 implemented; Phase 3 `needs_input`.
- Next Loop: offline dataset/calibration only after exact project-local prior, scalarization and readiness inputs are approved.
- Requested decision: provide the missing Phase 3 calibration inputs; no candidate is generated before them.
- Stop: no Phase 3 implementation, pilot, activation, Portti B or external write under the current Phase 2 authority.

## Next review basis

Approved Phase 3 calibration inputs or new Phase 2 evidence.
