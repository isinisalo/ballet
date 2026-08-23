---
id: governed-policy-calibration-and-promotion-review
title: Governed Policy Calibration and Promotion REVIEW
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - review
  - calibration
---

# Governed Policy Calibration and Promotion REVIEW

## Current verdict

Phase 1 governance is prepared for review. No Phase 2–7 runtime implementation, calibration, candidate, shadow decision, pilot, activation or rollback has occurred.

## Findings

- **Fact GPCP-R-F-001:** accepted ADR-026 and review ADR-028 do not authorize automatic calibration or promotion.
- **Finding GPCP-R-FIND-001:** the current observation contract is insufficient for provider-neutral complete cost calibration and hierarchy-safe aggregation.
- **Decision GPCP-R-D-001:** pending project owner acceptance of `goal-019` and `adr-030`.
- **Assumption GPCP-A-001:** unresolved; exact expert priors, scalarization and thresholds are not yet authored.
- **Hypothesis GPCP-H-001:** untested; no pilot or shadow evidence exists.

## QS verdict

| QS | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| QS-025 | Immutable deterministic calibration/promotion chain and human activation | GPCP-EVID-001 | governance chain passed locally; runtime evidence absent |

## Conformance review

The bounded diff is an intended draft architecture update. It preserves accepted ADR-026's no-history-default/no-online-update decision, review ADR-028's projector/proper-policy/no-fallback invariants, immutable Root Run snapshots, Work→Validation→bounded retry, Repair and human external-write gates. No production runtime, schema, API, provider, UI, project config or accepted decision text changed.

The only supersession proposal is explicit: if ADR-030 is accepted, it reassigns ADR-028's anticipated Portti B v17/v10/v13 number reservation to the earlier calibration/registry/shadow cut while preserving Portti B's separate semantic approval gate. This is not active while ADR-030 remains draft.

Remaining limitation: `GPCP-EVID-001` proves document/package/startup conformance only. `GPCP-EVID-002`–`GPCP-EVID-007` remain pending and block implementation acceptance, pilot claims and activation.

## Handoff

- Current status: `draft`, human decision required.
- Next Loop: implementation planning only after decision acceptance.
- Requested decision: accept or reject `goal-019` and `adr-030` as the authority for Phases 2–7.
- Stop: no implementation, pilot, activation, Portti B or external write under this draft.

## Next review basis

Project owner decision on `goal-019` and `adr-030`.
