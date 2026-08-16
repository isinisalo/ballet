---
id: arc42-initiative-plan-template
title: Initiative implementation plan template
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - initiative
  - plan
---

# Initiative PLAN

## Purpose

Plan one bounded implementation against accepted architecture and measurable quality scenarios.

## Status

Template accepted; an initiative PLAN remains `draft` until its inputs are reviewed.

## Required content

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<initiative>-step-001` | required | required | required | required | when relevant | required | required | required |

Also record ordering, dependencies, migrations, rollback/compatibility implications, legacy removal, risks, explicit non-goals and the exact checks to run. A PLAN never grants release/deploy authority.

## Canonical sources

The initiative BRIEF, arc42 sections, accepted ADRs and current source/tests.

## Relevant decisions

Reference only decisions needed by this initiative; propose a new ADR when a choice is important, risky, expensive or contentious.

## Evidence

Record reviewed IDs and source locations, not copied document bodies.

## Open questions

Any unresolved item that changes scope, architecture or acceptance stops implementation with `needs_input`.

## Next review basis

Ready for implementation when every in-scope QS has a test/monitor and expected evidence.
