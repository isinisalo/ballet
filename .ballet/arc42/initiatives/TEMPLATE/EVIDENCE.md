---
id: arc42-initiative-evidence-template
title: Initiative evidence template
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - initiative
  - evidence
---

# Initiative EVIDENCE

## Purpose

Collect acceptance and architecture-conformance evidence without becoming a runtime log dump.

## Status

Template accepted; individual evidence rows state `pending`, `passed`, `failed` or `blocked`.

## Evidence records

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| `<initiative>-evid-001` | required | exact command or observation | required | pending | required | required |

Include changed paths, diff-to-plan findings, acceptance results, conformance findings and any unavailable check with exact error and impact. Never include secrets or hidden chain-of-thought.

## Canonical sources

Actual commands, test outputs, reviewed diffs and runtime evidence. Full transient logs remain in Ballet runtime storage or named external systems.

## Relevant decisions

Link the ADR/CON/BB/RT/DEP IDs whose conformance is evidenced.

## Evidence

This file is itself the initiative evidence index; each claim needs a concrete source.

## Open questions

Unresolved evidence gaps stay explicit and block acceptance when they affect an in-scope priority-1 QS.

## Next review basis

Ready for REVIEW when planned checks are passed or their blocking impact is explicitly decided by a human.
