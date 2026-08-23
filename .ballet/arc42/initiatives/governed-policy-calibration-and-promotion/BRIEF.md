---
id: governed-policy-calibration-and-promotion-brief
title: Governed Policy Calibration and Promotion BRIEF
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - brief
  - calibration
---

# Governed Policy Calibration and Promotion BRIEF

## Purpose and authority

Deliver the governed path from Portti A observations to immutable offline candidates, evaluation, shadow evidence and human activation under accepted `goal-019` / `REQ-019` and `adr-030`. Project owner accepted the Goal/ADR chain in commit `26698dda09c9e9fda5284d4bfa578d6084581dc5`.

## Fact, decision and finding

- **Fact GPCP-F-001:** Phase 2 implements strict v17/v10/v13 and policy observation v3 with measured-or-explicitly-unknown provider-neutral dimensions, inclusive scope attribution, execution provenance and parent/child observation links. Dataset snapshot, candidate registry, shadow provenance and promotion events do not yet exist.
- **Decision GPCP-D-001 (accepted):** observations never update a live model; offline candidate/proposal generation is automatic only after explicit readiness/evaluation gates, while activation and rollback require a human-selected exact model hash.
- **Finding GPCP-FIND-001:** resolved by project-owner acceptance of `goal-019` / `adr-030`; Phase 2 is implemented, while Phase 3 still lacks project-local expert priors and readiness values.
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

- **GPCP-OQ-001:** resolved: project owner accepted `goal-019` and `adr-030` in commit `26698dda09c9e9fda5284d4bfa578d6084581dc5`.
- Phase 3 requires exact project-local joint pseudo-count priors, sample/coverage/readiness limits and scalarization rules; no values have been invented.

## Next review basis

Review Phase 2 at `GPCP-EVID-002`; begin Phase 3 only after the missing project-local calibration inputs are approved.
