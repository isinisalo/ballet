---
id: arc42-section-08
title: Crosscutting concepts
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - concepts
arc42Section: 8
---

# 8. Crosscutting concepts

## Purpose

Explain recurring, quality-driven solution approaches that affect multiple building blocks.

## Status

The concepts are selected for architectural significance; this is not a catalog of every implementation convention.

| ID | Concept | Applies to | Quality scenarios | Implementation anchors |
| --- | --- | --- | --- | --- |
| CON-001 | Least-authority local execution: loopback API, explicit Origin policy, worktree-only writes, network-off default and human external-write authorization. | BB-002, BB-004, BB-006, BB-007 | QS-001, QS-004, QS-007 | ADR-006, ADR-008, execution permission policy |
| CON-002 | Durable canonical control: strict role outcomes, atomic State patches, append-only revisions, bounded retries and runtime-owned continuation. | BB-004, BB-005, BB-006 | QS-003 | ADR-015, runtime/state stores |
| CON-003 | Deterministic execution composition: System → primary → sorted skills → Task Envelope → role schema, all snapshotted and hashed. | BB-003, BB-004, BB-006 | QS-002, QS-004 | ADR-012, ADR-013, ExecutionComposition |
| CON-004 | Portable project resources: repository paths own config, docs, instructions and skills; machine state remains under `.git/ballet`. | BB-003, BB-008 | QS-002, QS-005 | ADR-002, ADR-014, project resource catalog |
| CON-005 | Cyber-industrial operator UI: dense, accessible, token-driven React/Tailwind/shadcn surfaces with explicit operational state. | BB-001 | QS-001 | [DESIGN.md](../../DESIGN.md), goal-007 |
| CON-006 | Evidence-driven arc42 Method: stable IDs, explicit fact/decision/assumption/hypothesis/finding/question types, initiative handoff, traceability and measured method health. | BB-003, BB-004, BB-005, BB-008 | QS-005, QS-006, QS-008 | goal-009, ADR-011, project-local arc42 resources |

## Information classification

- **Fact**: directly verifiable from accepted source, code, configuration or evidence.
- **Decision**: accepted choice owned by a Goal/ADR or an explicitly authorized initiative decision.
- **Assumption**: unverified premise with owner and review trigger.
- **Hypothesis**: proposed causal improvement with baseline and measurable expected result.
- **Finding**: evidence-backed observation from review, validation or research.
- **Open question**: missing information that may require `needs_input` and must not be invented.

## Canonical sources

ADRs own decisions, `DESIGN.md` owns the UI system, and the linked implementation anchors own executable behavior.

## Relevant decisions

`adr-002`, `adr-005`–`adr-008`, `adr-011`–`adr-015`.

## Evidence

Crosscutting concepts map to specific QS and BB IDs and are covered by TRACEABILITY.

## Open questions

- No additional concept is promoted without cross-block impact or quality significance.

## Next review basis

Review when evaluation finds repeated inconsistency across building blocks or a priority quality scenario lacks a crosscutting solution.
