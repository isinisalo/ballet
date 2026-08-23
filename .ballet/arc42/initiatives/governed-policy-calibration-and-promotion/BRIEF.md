---
id: governed-policy-calibration-and-promotion-brief
title: Governed Policy Calibration and Promotion BRIEF
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - brief
  - calibration
---

# Governed Policy Calibration and Promotion BRIEF

## Purpose and authority

Prepare the governed path from Portti A observations to immutable offline candidates, evaluation, shadow evidence and human activation under draft `goal-019` / `REQ-019` and `adr-030`. This initiative is not authorized for implementation until those drafts are explicitly accepted.

## Fact, decision and finding

- **Fact GPCP-F-001:** current v16/v9/v12 shape/store supports scoped outcome/state evidence, `durationMillis` and optional `actualCostMicros`, but the runtime observation producer does not populate actual cost. Provider token usage is not aggregated consistently into option observations, and no complete provider-neutral cost dimensions, dataset snapshot, candidate registry, shadow provenance or promotion event exists.
- **Decision GPCP-D-001 (proposed):** observations never update a live model; offline candidate/proposal generation is automatic only after explicit readiness/evaluation gates, while activation and rollback require a human-selected exact model hash.
- **Finding GPCP-FIND-001:** ADR-026 rejects automatic learning and ADR-028 excludes calibration, so Phase 2 has no accepted architecture authority.
- **Assumption GPCP-A-001:** project owners can provide explicit priors, scalarization and readiness/promotion thresholds; not yet verified.
- **Hypothesis GPCP-H-001:** immutable joint calibration plus shadow evidence can improve cost-to-go routing without weakening snapshot or authorization boundaries; pilot pending.

## Stakeholders and expectations

The project owner owns priors, scalarization, thresholds, activation, rollback and pilot authorization. Runtime maintainers need one coordinated strict cut and deterministic recovery. Reviewers need content-addressed lineage and reproducible reports. Operators need controller/shadow and active/candidate provenance to remain distinct.

## Scope

Master-roadmap Phases 2–7: cost observations, offline calibration/registry, evaluation, shadow, gated pilot and promotion proposals.

## Non-goals

Runtime implementation before approval, invented calibration inputs, online learning, automatic activation, profile-aware options, Portti B, deploy/release/merge/push and any external write.

## Quality and acceptance

Priority-1 `QS-025` requires immutable datasets/models, deterministic reruns, fail-closed unknown/readiness behavior, no hierarchy double counting, separate controller/shadow provenance and exactly zero live-reference mutations without human activation.

## Open questions

- **GPCP-OQ-001:** does the project owner accept `goal-019` and `adr-030` as the authority for Phases 2–7?
- Calibration values are deliberately not requested until the strict contracts and authoring surface exist; they remain a later pilot gate.

## Next review basis

Ready for implementation planning only after explicit acceptance of `goal-019`, `adr-030` and `QS-025` intent.
