---
id: fixture-UC-02
title: Verify fixture evidence
status: approved
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [fixture, use-case]
examples:
  - { given: the preparation State is done, when: verification Actions execute by priority, then: the fixture reaches a terminal evidence projection }
  - { given: preparation is incomplete, when: verification is considered, then: no verification Action starts }
successGoals: [Verify deterministic gate and terminal projection]
failureGoals: [Do not bypass the first State]
expectedOutcomes: [A completed fixture Environment or visible blocked Feedback]
goalIds: [test-goal]
adrIds: [0001-test-adr]
constraintIds: [fixture-constraint]
approval: { approvedBy: fixture-human, approvedAt: '2026-08-29T00:00:00.000Z', revision: 1, contentHash: a4e176b053000c23cd2b951e5be849509b8b92febf3fa95ad0925549bcd2230c }
---

# Verify fixture evidence

Given a completed preparation State, when verification Actions execute by priority, then the fixture reaches terminal evidence. If preparation is incomplete, no verification Action may start.
