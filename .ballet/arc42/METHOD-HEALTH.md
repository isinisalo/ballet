---
id: arc42-method-health
title: Ballet arc42 method health
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - method-health
  - continuous-learning
---

# Ballet arc42 method health

## Purpose

Track evidence about how the development method behaves and authorize improvements only from measured need.

## Status

The measurement contract is accepted. Operational values are `not measured` until the first arc42 Root Run supplies runtime evidence.

## Health metrics

| Metric ID | Metric | Baseline | Source | Review trigger |
| --- | --- | --- | --- | --- |
| MH-FAIL | Validation FAIL count and categorized reasons | not measured | Root Run Validation outcomes | repeated reason in 2 initiatives |
| MH-RETRY | Local retries by Node and cause | not measured | Node Run attempts | same Node exceeds 1 retry in 2 runs |
| MH-REPAIR | Orchestrator repairs and selected targets | not measured | Repair Requests and routes | ambiguity or repeated target mismatch |
| MH-OQ | Repeated open questions | not measured | BRIEF/REVIEW and STATUS | same question survives 2 reviews |
| MH-STALE | Stale or contradictory document findings | migration baseline: summary had v9 facts while config was v10 | evaluation findings | any accepted source contradiction |
| MH-DRIFT | Architecture drift findings | not measured | conformance review | any high-impact unaccepted drift |
| MH-EVID | Test and quality-scenario evidence gaps | initial QS rows include pending evidence | TRACEABILITY and REVIEW | release candidate has a pending priority-1 QS |
| MH-MANUAL | Manual interventions and reasons | not measured | needs_input and Human Node outcomes | same avoidable reason in 2 runs |

## Improvement ledger

| Change ID | Baseline | Hypothesis | Proposed improvement | Expected measurable result | Approval | Actual impact | Evaluation due |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MHC-001 | 4 delivery Loops, 0 selected project skills, legacy `migrated-*` instructions, no shared architecture trace | 6+1 capability Loops plus stable arc42 artifacts reduce drift and ambiguous handoffs | Adopt `adr-011` and the strict-v10 arc42 graph | `validate:arc42` has 0 issues; first pilot has complete Goal→evidence trace and no fallback route | explicitly authorized 2026-08-16 | pending pilot | after first REVIEW |

## Change policy

Automatic correction is limited to a low-risk broken document link, index, format, deterministic lint or deterministic test when semantics do not change. Goal, ADR, Loop, permission, network, release/deploy, instruction and skill behavior changes require explicit human approval. Every method change records a baseline, hypothesis, expected result and later evaluation.

## Canonical sources

Runtime counts come from Root Run evidence; persistent findings and decisions come from initiative REVIEWs, [TRACEABILITY](TRACEABILITY.md), [STATUS](STATUS.md) and section 11.

## Relevant decisions

`goal-009`, `adr-011`, `adr-015`.

## Evidence

The migration assessment documents the initial stale-document and legacy findings. No runtime counter is fabricated.

## Open questions

- `OQ-002`: Which first initiative will establish the operational baselines?

## Next review basis

Update from the evaluate Loop after an initiative or from scheduled continuous learning only when material evidence exists.
