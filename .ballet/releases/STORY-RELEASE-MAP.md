---
id: story-release-map
title: Story / Release Map
version: 1
updatedAt: 2026-08-20
---

# Story / Release Map

This ordered map owns what is delivered and in which order. Implementation tasks live only in the configured `tk` work store.

## REL-GE-001 · Graph Engineering RunBook

- Status: `building`
- Target environment: local Ballet checkout
- Design: `GOAL-014`, `REQ-014`, `ADR-022`, `QS-016`, `QS-017`, `QS-018`
- Acceptance: `.ballet/arc42/initiatives/graph-engineering-runbook/REVIEW.md`
- Stories, in order:
  - `STORY-GE-001` — deterministic five-Loop RunBook and strict version cut
  - `STORY-GE-002` — fail-closed two-store `tk` integration
  - `STORY-GE-003` — simplified Graph Engineering projection with Workflow visual stability

## REL-GE-002 · Live tk qualification

- Status: `planned`
- Target environment: local Ballet checkout with pinned `tk` prerequisite
- Design: `ADR-022`, `QS-018`
- Acceptance: successful real-CLI smoke against revision `d778bb520ee526c314c26f2bb876447e0a19caa5`
- Stories, in order:
  - `STORY-GE-004` — qualify the pinned real `tk` binary after installation

