---
id: governed-policy-calibration-and-promotion-plan
title: Governed Policy Calibration and Promotion PLAN
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - plan
  - calibration
---

# Governed Policy Calibration and Promotion PLAN

## Status and dependency order

`goal-019` and `adr-030` are accepted. Step 001 is implemented in strict v17/v10/v13 with policy observation v3. Execute later steps strictly in order and stop whenever a prerequisite, required project-local calibration input or `QS-025` gate fails.

## Planned slices

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| governed-policy-calibration-step-001 | goal-019 / REQ-019 | QS-023, QS-025 | adr-030 / CON-012 | BB-005, BB-012 | RT-017, RT-019 / DEP-001 | Strict observation/API/SQLite contracts; duration, usage, retries, monetary/utility dimensions and hierarchy refs | observation attribution/unknown/provenance/restart tests | GPCP-EVID-002 |
| governed-policy-calibration-step-002 | goal-019 / REQ-019 | QS-025 | adr-030 / CON-012 | BB-003, BB-011, BB-012 | RT-019 / DEP-001 | Dataset snapshot, expert priors, joint calibration, immutable candidate registry/hash/lineage and report | deterministic snapshot/calibration/readiness/hash tests | GPCP-EVID-003 |
| governed-policy-calibration-step-003 | goal-019 / REQ-019 | QS-022, QS-025 | adr-030 / CON-012 | BB-011, BB-012 | RT-019 / DEP-001 | Exact evaluation, seeded simulation, held-out metrics, sensitivity and project-local thresholds | analytic/simulation cross-check and insufficient-evidence tests | GPCP-EVID-004 |
| governed-policy-calibration-step-004 | goal-019 / REQ-019 | QS-023, QS-025 | adr-030 / CON-012 | BB-004, BB-005, BB-011, BB-012 | RT-017, RT-019 / DEP-002 | Controller/shadow snapshot, decisions and read models | same-epoch/action-set, zero-shadow-dispatch and no-counterfactual tests | GPCP-EVID-005 |
| governed-policy-calibration-step-005 | goal-019 / REQ-019 | QS-022, QS-023, QS-025 | adr-028, adr-030 / CON-012 | BB-003–BB-005, BB-011, BB-012 | RT-017, RT-019 / DEP-002 | Hermetic five-GraphNode pilot fixtures, restart/resume, budgets and stop conditions | authorized pilot matrix and retained-failure inspection | GPCP-EVID-006 |
| governed-policy-calibration-step-006 | goal-019 / REQ-019 | QS-025 | adr-030 / CON-012 | BB-002, BB-003, BB-012 | RT-019 / DEP-001 | Candidate → evaluation → proposal automation; human activation and rollback to exact hash | promotion/activation/rollback/snapshot immutability tests | GPCP-EVID-007 |

## Contract and migration policy

Use one coordinated hard cut beginning with Project Config v17, Root Snapshot v10 and SQLite v13; bump every other touched strict contract in the same slice. Add no compatibility reader, dual-write, alias or runtime migration. Old databases may fail closed with an exact version message. Graph Node Module remains v5 unless its package contract actually changes.

## Risks and stop conditions

- Unknown required cost dimension, insufficient coverage, invalid prior, failed evaluation, improper policy or missing exact hash stops before proposal/activation.
- Do not sum global and local inclusive costs in one aggregate.
- Do not infer a counterfactual from an unchosen shadow action.
- Do not mutate a running snapshot, observation, dataset, model or report.
- Do not activate, rollback, run a calibrated pilot, remove agent routers or perform external writes without the exact separate human authorization.

## Checks

Focused contract/persistence/calibration/evaluation/shadow tests, then `npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build`, platform-boundary search, `git diff --check`, `make latest` and installed `ballet` startup.
