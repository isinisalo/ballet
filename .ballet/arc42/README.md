---
id: arc42-index
title: Ballet arc42 architecture index
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 2
tags:
  - arc42
  - architecture
  - index
---

# Ballet arc42 architecture index

## Purpose

This directory is the canonical, version-controlled architecture Template. Ballet Loops implement the continuous Method that maintains it.

## Status

The initial migration baseline is accepted. Verified content is placed in the relevant section; missing knowledge is an explicit open question rather than invented detail.

## Sections

1. [Introduction and goals](01-introduction-and-goals.md)
2. [Constraints](02-constraints.md)
3. [Context and scope](03-context-and-scope.md)
4. [Solution strategy](04-solution-strategy.md)
5. [Building block view](05-building-block-view.md)
6. [Runtime view](06-runtime-view.md)
7. [Deployment view](07-deployment-view.md)
8. [Crosscutting concepts](08-crosscutting-concepts.md)
9. [Architecture decisions](09-architecture-decisions.md)
10. [Quality requirements](10-quality-requirements.md)
11. [Risks and technical debt](11-risks-and-technical-debt.md)
12. [Glossary](12-glossary.md)

Supporting sources: [STATUS](STATUS.md), [TRACEABILITY](TRACEABILITY.md), [METHOD-HEALTH](METHOD-HEALTH.md), [STATE-CONTRACT](STATE-CONTRACT.md), [migration assessment](migration/ASSESSMENT.md) and the [initiative template](initiatives/TEMPLATE/BRIEF.md).

## Canonical sources

Accepted Goals own WHAT/WHY, accepted ADRs own architecture decisions, these twelve sections own architecture views and explanations, `DESIGN.md` owns the UI design system and initiative folders own bounded delivery artifacts. Runtime state is not copied here.

## Relevant decisions

`goal-009`, `goal-010`, `adr-011`, `adr-013`, `adr-014`, `adr-015` and `adr-016`.

## Evidence

The official [arc42 method](https://arc42.org/method/) defines six recurring activities with continuous feedback; the official [arc42 documentation](https://docs.arc42.org/home/) defines the twelve sections above.

## Open questions

- No initiative-specific open question is promoted to project level until its impact crosses initiative boundaries.

## Next review basis

Review the index whenever a canonical path, section ownership or initiative handoff changes.
