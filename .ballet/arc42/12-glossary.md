---
id: arc42-section-12
title: Glossary
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - glossary
arc42Section: 12
---

# 12. Glossary

## Purpose

Define project terms whose precise shared meaning affects architecture, runtime or handoff.

## Status

Terms reflect accepted v10 and arc42 decisions.

| Term | Definition |
| --- | --- |
| arc42 Template | The twelve-section version-controlled architecture information structure under `.ballet/arc42/`. |
| arc42 Method | Six recurring architecture activities implemented here as Ballet Loops with continuous feedback. |
| 6+1 | Six arc42 activity Loops plus the supporting continuous-learning Loop. |
| Initiative | A bounded change with BRIEF, PLAN, EVIDENCE and REVIEW artifacts. |
| Work Loop Node | One goal composed of exactly one Work phase and one Validation phase. |
| State | Root Run-owned canonical bounded JSON coordination value; not a copy of documents. |
| State revision | Immutable post-patch State with revision number, hash and outcome/control evidence. |
| Repair Request | Immutable Validation finding describing a needed capability/outcome without selecting a target Loop. |
| Repair allowlist | Source-Loop-specific `repair` LoopEdges that constrain Orchestrator targets. |
| Continuation | Runtime-owned return address to the same caller Validation after repair completion. |
| Handoff | Concise persistent statement of current status, evidence, open questions and next approved action. |
| Fact | Information directly verified from a canonical source or evidence. |
| Decision | Accepted choice owned by a Goal/ADR or explicit human authorization. |
| Assumption | Unverified premise with owner and review trigger. |
| Hypothesis | Proposed causal improvement with baseline and expected measurable result. |
| Finding | Evidence-backed observation requiring no invented intent. |
| Open question | Missing information that may require `needs_input`. |
| External write | Push, merge, release, deploy, rollback, message or any mutation outside the authorized Root Run worktree. |

## Canonical sources

Accepted Goals/ADRs and shared domain terminology take precedence over this summary if a conflict is found; the conflict must then be repaired here.

## Relevant decisions

`adr-011`, `adr-013`, `adr-015`.

## Evidence

Terms are used consistently in project config, instructions, skills and State contract.

## Open questions

- Add a term only when inconsistent interpretation has real architecture or handoff impact.

## Next review basis

Review when a new stable domain term is accepted or evaluation finds ambiguous terminology.
