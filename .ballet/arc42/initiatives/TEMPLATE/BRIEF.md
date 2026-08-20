---
id: arc42-initiative-brief-template
title: Initiative brief template
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 2
tags:
  - arc42
  - initiative
  - brief
---

# Initiative BRIEF

## Purpose

Create `.ballet/arc42/initiatives/<initiative-id>/BRIEF.md` as the human/agent agreement on WHAT, WHY, scope and measurable acceptance before design.

## Status

Template accepted; a new initiative copy begins as `draft` and uses its own stable frontmatter ID.

## Required content

- Initiative ID, owner, status and linked Goal/Requirement IDs.
- **Fact**: current problem and verified context.
- **Decision**: human-approved WHAT/WHY and priority.
- Stakeholders and expectations.
- Scope and non-goals.
- Constraints and context interfaces.
- Top quality goals and complete QS IDs/criteria.
- **Assumption**, **Hypothesis**, **Finding** and **Open question** entries with stable IDs where relevant.
- Acceptance intent and the decision that authorizes the next Loop.

If WHAT/WHY, priority or a measurable success criterion is missing, stop with `needs_input` rather than filling it in.

## Canonical sources

Goals, arc42 sections 1–3 and 10, plus explicit human input. Do not copy their full content.

## Relevant decisions

`goal-009`, `adr-011`.

## Evidence

List source paths/URLs, timestamps for external snapshots and the human decision reference.

## Open questions

List unresolved questions with owner, impact and next decision point.

## Next review basis

Ready for the `arc42:requirements.clarified` → solution-strategy capability only when scope and all priority-1 acceptance measures are explicit.
