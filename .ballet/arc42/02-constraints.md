---
id: arc42-section-02
title: Constraints
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 2
tags:
  - arc42
  - constraints
arc42Section: 2
---

# 2. Constraints

## Purpose

Record the technical, organizational and process constraints that limit architecture choices.

## Status

The baseline is accepted from Goals, ADRs, repository instructions and current runtime contracts.

## Constraints

| ID | Type | Constraint | Source |
| --- | --- | --- | --- |
| CTR-001 | technical | The service binds to loopback and is scoped to one exact Git checkout. | goal-001, adr-001, adr-008 |
| CTR-002 | platform | Supported distribution is macOS arm64/x64 with launchd lifecycle. | goal-008, adr-009 |
| CTR-003 | architecture | Frontend, backend and shared contracts use one TypeScript application architecture. | adr-003 |
| CTR-004 | persistence | Runtime truth is checkout-local SQLite under `.git/ballet`; it is not version-controlled project truth. | adr-002, adr-007, adr-015 |
| CTR-005 | security | Network is off unless an explicit ExecutionProfile enables it; writes stay in the Root Run worktree. | goal-005, adr-006, adr-008 |
| CTR-006 | workflow | Project workflow belongs only in `.ballet/project.json`, `.ballet/instructions/**`, `.agents/skills/**` and `.ballet/arc42/**`. | adr-013, adr-014, adr-011 |
| CTR-007 | decisions | Agents must not invent missing WHAT/WHY or silently modify accepted ADR semantics. | goal-009, adr-011 |
| CTR-008 | external effects | Merge, push, release, deploy and rollback require explicit human authority. | goal-005, goal-009, adr-011 |
| CTR-009 | model | ExecutionProfile has no Responses API `reasoning.mode`; `medium` remains the baseline without eval evidence for higher effort or pro-mode. | adr-012, OpenAI model guidance |
| CTR-010 | design | `DESIGN.md` owns UI tokens and visual principles. | goal-007, DESIGN.md |
| CTR-011 | module trust | A Loop package is bounded untrusted UTF-8 JSON, has one Loop and no executable code/external writes; runtime uses only explicitly materialized project-local resources. | goal-010, adr-016 |

## Canonical sources

Accepted Goals and ADRs, `AGENTS.md`, `DESIGN.md`, `.ballet/project.json` and machine-local runtime contracts described in `README.md`.

## Relevant decisions

`adr-001`, `adr-002`, `adr-003`, `adr-006`, `adr-008`, `adr-009`, `adr-011`–`adr-016`.

## Evidence

Strict schemas, runtime tests and the platform-boundary grep enforce the technical constraints.

## Open questions

- Linux or Windows support would require a new Goal/ADR; it is not assumed.

## Next review basis

Review when platform support, security policy, model capability or project/workflow ownership changes.
