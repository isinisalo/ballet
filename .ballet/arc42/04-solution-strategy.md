---
id: arc42-section-04
title: Solution strategy
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - solution-strategy
arc42Section: 4
---

# 4. Solution strategy

## Purpose

Summarize the fundamental solution choices that satisfy the top quality goals and constraints.

## Status

The strategy is implemented unless a row explicitly names pending pilot evidence.

| ID | Strategy | Quality impact | Source |
| --- | --- | --- | --- |
| STRAT-001 | One checkout-local Node/TypeScript service with React UI and shared strict contracts. | Limits context drift and deployment complexity. | adr-001, adr-003 |
| STRAT-002 | Version-controlled project intent separated from `.git/ballet` runtime state. | Makes intent reviewable while keeping machine state local. | adr-002 |
| STRAT-003 | Immutable Root Run snapshot plus isolated Git branch/worktree. | Protects the active checkout and makes results attributable. | adr-006 |
| STRAT-004 | Provider-neutral adapters and explicit ExecutionProfiles/resources. | Avoids hidden provider/model fallback and preserves prompt evidence. | adr-005, adr-012, adr-013 |
| STRAT-005 | Strict-v10 Work/Validation, revisioned State and capability repair call/return. | Makes decisions, retries and repairs deterministic and recoverable. | adr-015 |
| STRAT-006 | arc42 Template as durable truth and 6+1 Ballet Loops as the continuous Method. | Connects architecture, implementation and evaluation through stable evidence. | goal-009, adr-011 |
| STRAT-007 | Explicit human gates for intent, significant decisions and external writes. | Preserves authority at high-impact boundaries. | adr-011 |

## Canonical sources

Accepted ADRs own the decisions; this section owns only their strategic synthesis.

## Relevant decisions

`adr-001`–`adr-003`, `adr-005`–`adr-009`, `adr-011`–`adr-015`.

## Evidence

Existing source and tests implement strategies 1–5. `validate:arc42` verifies strategy 6 configuration; the first initiative will supply effectiveness evidence.

## Open questions

- Does the first pilot show that the current human gates are sufficient without becoming repetitive?

## Next review basis

Review when a top quality goal changes or evaluation finds that a fundamental strategy does not produce its measurable response.
