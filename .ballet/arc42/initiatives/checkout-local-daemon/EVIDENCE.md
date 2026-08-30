---
id: cld-evidence-001
title: Checkout-local daemon evidence
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-30'
version: 3
tags: [arc42, initiative, evidence]
---

# Evidence

| ID | Claim | Evidence status |
| --- | --- | --- |
| EVID-038 | one-time claim, fencing, event ordering, duplicate terminal and fail-closed lease recovery | transaction/restart tests pass; packaged launchd daemon recovered in 8 s and retained one stable PID across two 18 s observations |
| EVID-039 | strict Action-role v1 and governance Agent v2 binding/provider contracts | upsert/cleanup, wrong State/Action/role, model/reasoning/network/roots mismatch and zero-dispatch tests pass; Action UI derives provider→model→reasoning and exposes nested Skills plus distinct saves |
| EVID-040 | full strict cut and packaged server+daemon startup | 38 files / 306 tests; arc42/cutover/lint/build/design/diff gates pass; desktop/narrow overflow and console error counts are 0; `make latest` SHA-256 `36fd6a2551ee2c44f776bbbc0b9dd3a7b79cbeb51e9ca00fc844fe98a7072241` created SQLite v19 and a healthy server/daemon pair |

Evidence is updated only from completed commands. A real Codex/Copilot provider occurrence is not claimed by repository tests.
