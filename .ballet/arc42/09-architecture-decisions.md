---
id: arc42-section-09
title: Architecture decisions
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 2
tags:
  - arc42
  - decisions
arc42Section: 9
---

# 9. Architecture decisions

## Purpose

Index the canonical ADR files without copying their context, decision or consequences.

## Status

The index reflects repository state on 2026-08-16.

| ID | Status | Canonical ADR |
| --- | --- | --- |
| adr-001 | accepted | [Checkout-local service](../adr/adr-001-checkout-kohtainen-paikallinen-palvelu.md) |
| adr-002 | accepted | [Portable project definition and local runtime state](../adr/adr-002-kannettava-projektimaaritys-ja-paikallinen-tila.md) |
| adr-003 | accepted | [Shared TypeScript application architecture](../adr/adr-003-yhteinen-typescript-sovellusarkkitehtuuri.md) |
| adr-004 | superseded by adr-015 | [Legacy Loop/Step/Transition model](../adr/adr-004-loop-step-transition-run-domain-malli.md) |
| adr-005 | accepted | [Provider-neutral execution](../adr/adr-005-provider-neutraali-agenttisuoritus.md) |
| adr-006 | accepted | [Root Run Git worktree isolation](../adr/adr-006-root-run-git-worktree-eristys.md) |
| adr-007 | accepted | [Durable SQLite state](../adr/adr-007-sqlite-suoritus-ja-ajastustila.md) |
| adr-008 | accepted | [Loopback API and closed permission model](../adr/adr-008-loopback-api-ja-suljettu-oikeusmalli.md) |
| adr-009 | accepted | [Verified macOS distribution](../adr/adr-009-varmennettu-macos-jakelu.md) |
| adr-010 | superseded by adr-015 | [Legacy StepResult/runtime separation](../adr/adr-010-step-result-erotetaan-runtime-statesta.md) |
| adr-011 | accepted | [arc42 Template and continuous Ballet Method](../adr/adr-011-arc42-template-ja-jatkuva-ballet-method.md) |
| adr-012 | accepted | [ExecutionProfile separation](../adr/adr-012-execution-profile-erotetaan-stepin-instructions-ja-skills-valinnoista.md) |
| adr-013 | accepted | [Workflow details belong to skills](../adr/adr-013-workflow-yksityiskohdat-kuuluvat-skillsiin.md) |
| adr-014 | accepted; V1 scope partially superseded by adr-016 | [Workflow templates are project-local data](../adr/adr-014-workflow-templatet-ovat-project-local-dataa.md) |
| adr-015 | accepted | [Work Loop, revisioned State and Loop Orchestrator](../adr/adr-015-work-loop-state-ja-loop-orchestrator.md) |
| adr-016 | accepted | [One-Loop module package and project-local materialization](../adr/adr-016-yhden-loopin-moduulipaketti-ja-project-local-materialisointi.md) |

## Canonical sources

Only `.ballet/adr/*.md` files own architecture decisions. This index is navigational and validated.

## Relevant decisions

All ADRs above; `adr-011` defines this indexing rule.

## Evidence

`npm run validate:arc42` resolves every ADR reference and confirms the referenced frontmatter ID.

## Open questions

- None. A new significant decision is a proposal until a human accepts it.

## Next review basis

Update whenever an ADR is added, accepted or superseded.
