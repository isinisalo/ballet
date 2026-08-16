---
id: arc42-section-11
title: Risks and technical debt
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - risks
  - technical-debt
arc42Section: 11
---

# 11. Risks and technical debt

## Purpose

Maintain architecture-significant risks, debt and evidence gaps with explicit status and response.

## Status

The migration baseline is accepted; risk closure requires cited evidence.

| ID | Type | Finding | Impact/likelihood | Response and trace | Status |
| --- | --- | --- | --- | --- | --- |
| RISK-001 | evidence gap | The new 6+1 Method has no completed end-to-end initiative evidence. | medium/high until pilot | Pilot with QS-006 and EVID-006; compare METHOD-HEALTH baseline. | open |
| RISK-002 | documentation drift | Historical summary/output documents contained strict-v9 or legacy workflow statements after v10 implementation. | medium/observed | Canonicalize arc42, supersede old outputs, validate links and versions with TEST-005. | mitigated by migration; monitor |
| RISK-003 | routing ambiguity | Broad repair descriptions could allow several target Loops. | high/possible | Capability-specific descriptions; Orchestrator returns `needs_input` when evidence does not distinguish. Trace QS-003. | controlled |
| RISK-004 | external write | Release/deploy/rollback could exceed the user's current authority. | high/possible | Release kept outside default flow, exact Human Validation and needs_input before unapproved action. Trace QS-007. | controlled |
| RISK-005 | State misuse | Agents could copy documents into State or encode control decisions in patches. | medium/possible | Arc42MethodStateV1 bounded references, strict patch evidence, reviewer validation. | controlled; verify in pilot |
| RISK-006 | method churn | Scheduled learning could rewrite process/docs from model preference. | medium/possible | Primary-source evidence, materiality threshold, no-change outcome and human approval for behavior changes. Trace QS-008. | controlled; verify in pilot |
| RISK-007 | provider capability | Selected GPT-5.6 model/profile may be unavailable or change capability. | medium/possible | Explicit preflight and no fallback; evaluate changes before profile mutation. | accepted operational risk |

## Canonical sources

This section owns project-level architecture risks. Initiative-specific risks begin in BRIEF/PLAN and are promoted here only when they cross initiative boundaries.

## Relevant decisions

`adr-005`, `adr-006`, `adr-008`, `adr-011`, `adr-015`.

## Evidence

Migration findings, validation results, Root Run outcomes and initiative REVIEWs.

## Open questions

- RISK-001, RISK-005 and RISK-006 require first-pilot evidence.

## Next review basis

The evaluate Loop updates this file for material risk, debt, stale decisions or architecture drift; cosmetic rewording is not a review trigger.
