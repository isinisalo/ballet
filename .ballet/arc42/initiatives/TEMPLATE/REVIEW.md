---
id: arc42-initiative-review-template
title: Initiative review template
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - initiative
  - review
---

# Initiative REVIEW

## Purpose

Evaluate the delivered initiative against its BRIEF, PLAN, quality scenarios and architecture, then hand off the next approved action.

## Status

Template accepted; a REVIEW becomes `accepted` only after evidence-backed evaluation and required human decisions.

## Required content

- Summary of changes without duplicating canonical architecture text.
- **Fact**: delivered artifact paths and evidence IDs.
- **Decision**: accepted/rejected outcomes and human authorization references.
- **Assumption** and **Hypothesis** outcomes.
- **Finding**: risk, technical debt, architecture drift, stale decision or documentation contradiction.
- **Open question** with owner and impact.
- Per-QS verdict with measurable criterion, evidence and status.
- Updates required to section 11, TRACEABILITY and METHOD-HEALTH.
- Handoff: current status, next Loop, requested capability/outcome and next approved action.

## Canonical sources

Initiative BRIEF/PLAN/EVIDENCE, current arc42 sections, accepted ADRs and runtime evidence.

## Relevant decisions

List all decisions evaluated or proposed for reconsideration. Do not edit an accepted ADR silently.

## Evidence

Every verdict cites an evidence ID and concrete source.

## Open questions

Ambiguous repair target or missing decision returns `needs_input`.

## Next review basis

Close only when the handoff is explicit; re-open when later evidence invalidates a measured conclusion.
