---
id: capability-first-authoring-evidence
title: Capability-first Authoring EVIDENCE
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - evidence
  - ui
---

# Capability-first Authoring EVIDENCE

## Evidence index

| ID | Claim | Evidence | Status |
| --- | --- | --- | --- |
| CFA-EVID-001 | Capability/Jobs and decision-model sections are canonical URL state. | routing/navigation tests | verified locally |
| CFA-EVID-002 | GraphNode/JobNode CRUD updates policy references and blocks referenced deletion. | authoring tests and UI component paths | verified locally |
| CFA-EVID-003 | Upper canvases and multi-ring implementation are absent; Job industrial flow remains. | source boundary search and Job flow tests | verified locally |
| CFA-EVID-004 | Run separates current decision, bounded projection/rollout and factual observations. | Run policy view tests | verified locally |
| CFA-EVID-005 | Desktop/narrow visual, focus, long-ID, CRUD/error and 1/5/40 + 1/17/64 scale QA. | in-app browser metrics and `evidence/*.png` | passed for capability-first surfaces; owner visual verdict pending |
| CFA-EVID-006 | Protected Job industrial flow remains structurally unchanged and narrow core nodes do not overlap. | Job-flow tests, deterministic narrow coordinates and release build | passed automated; post-fix browser screenshot pending after browser reconnect failure |

## Current local result

The 2026-08-23 local suite passed 49 files / 189 tests before the final narrow-layout assertion; the focused Job-flow rerun then passed 3 files / 11 tests. Browser QA measured:

- 1440×900 and 390×844 Capability Graph / Decision Model / Jobs surfaces: page horizontal overflow 0, card overlap 0, clipped buttons 0 and upper canvas nodes 0.
- Isolated scale fixture: 40 GraphNode cards and 64 JobNode cards in both viewports, with page overflow 0, card overlap 0 and clipped buttons 0.
- Capability contract dialog focuses its Description textarea and exposes intrinsic outcome semantics separately from scoped model probability/cost data.
- Global and local SSP drafts display scoped readiness issues, `Draft — Run blocked`, Repair outside the action set and no `Expected Path` terminology.
- Browser console warning/error count was 0 across capability, global/local model, Run-empty, CRUD and Job-flow tabs before the final service restart.

Stored screenshots: `evidence/decision-model-1440x900.png`, `evidence/decision-model-390x844.png`, `evidence/capability-graph-390x844.png`, `evidence/jobs-1440x900.png` and `evidence/local-decision-model-1440x900.png`.

The first narrow Job-flow measurement exposed an inherited `Retry count` / `Retry?` overlap. The accepted zero-overlap invariant was restored by moving only the narrow read-only retry-count coordinate from y=430 to y=360; Work/Validation, junctions, edges and runtime semantics did not change. Its pure regression test, build and packaged smoke pass. The in-app browser stopped navigating localhost after the final service restart, so the obsolete pre-fix screenshot was removed and a post-fix screenshot remains explicitly pending.
