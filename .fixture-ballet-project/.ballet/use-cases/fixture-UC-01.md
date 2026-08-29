---
id: fixture-UC-01
title: Prepare fixture evidence
status: approved
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [fixture, use-case]
examples:
  - { given: a clean fixture checkout, when: the first State executes, then: Validation delegates a bounded evidence artifact }
successGoals: [Produce deterministic fixture evidence]
failureGoals: [Do not skip Validation]
expectedOutcomes: [The first State completes before the second starts]
goalIds: [test-goal]
adrIds: [0001-test-adr]
constraintIds: [fixture-constraint]
approval: { approvedBy: fixture-human, approvedAt: '2026-08-29T00:00:00.000Z', revision: 1, contentHash: 35997ff04ef663f3882f689e5416af95658c9d3de7efae965bfc4e91bce4dc61 }
---

# Prepare fixture evidence

Given a clean fixture checkout, when the first State executes, then Validation delegates a bounded evidence artifact. Success means deterministic local evidence; skipping Validation is a failure.
