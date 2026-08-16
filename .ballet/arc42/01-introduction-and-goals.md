---
id: arc42-section-01
title: Introduction and goals
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - requirements
arc42Section: 1
---

# 1. Introduction and goals

## Purpose

Summarize Ballet's business purpose, essential requirements, top quality goals and stakeholders. Detailed accepted intent remains in the Goal files.

## Status

The baseline reflects accepted `goal-001`–`goal-009`.

## Requirements overview

| ID | Goal source | Requirement |
| --- | --- | --- |
| REQ-001 | goal-001 | Operate as a checkout-local command center without a Ballet account or remote control plane. |
| REQ-002 | goal-002 | Keep project intent and automation portable, version controlled and reviewable. |
| REQ-003 | goal-003 | Compose provider execution from an explicit ExecutionProfile, primary instruction and selected skills. |
| REQ-004 | goal-004 | Execute Work/Validation Loops with revisioned State, bounded retry, repair and scheduling. |
| REQ-005 | goal-005 | Isolate each Root Run in a verifiable Git worktree and never merge or push automatically. |
| REQ-006 | goal-006 | Persist runtime state and expose restart-safe evidence and observability. |
| REQ-007 | goal-007 | Provide a dense, accessible and unambiguous operator experience. |
| REQ-008 | goal-008 | Support verified macOS packaging and checkout-specific lifecycle management. |
| REQ-009 | goal-009 | Use arc42 as shared architecture truth and Ballet Loops as a continuous, evidence-driven Method. |

## Top quality goals

1. Safety: local and external effects obey explicit workspace, network and human-authorization boundaries.
2. Traceability: intent, decisions, implementation and evidence are connected through stable IDs.
3. Recoverability: durable State, outcomes and control flow resume only from fully committed facts.

Detailed measurable scenarios are in [section 10](10-quality-requirements.md).

## Stakeholders

| Stakeholder | Expectations |
| --- | --- |
| Project owner | Retains WHAT/WHY, priority, acceptance and external-write authority. |
| Software architect | Maintains coherent structures, concepts, decisions, risks and traceability. |
| Developer/agent operator | Receives a bounded plan, clear constraints, tests and actionable handoff. |
| Reviewer | Evaluates independently without changing the implementation under review. |
| Release operator | Authorizes and observes exact release/deploy/rollback actions. |

## Canonical sources

`.ballet/goals/*.md`, `.ballet/goals/summary.md`, [STATUS](STATUS.md).

## Relevant decisions

`adr-001`, `adr-002`, `adr-011`, `adr-015`.

## Evidence

Goal frontmatter status and the trace matrix identify accepted intent and current verification.

## Open questions

- Initiative-specific stakeholders and acceptance intent are completed in each BRIEF.

## Next review basis

Review when an accepted Goal changes or a recurring initiative-level stakeholder expectation becomes project-wide.
