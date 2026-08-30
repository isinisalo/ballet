---
id: cld-evidence-001
title: Checkout-local daemon evidence
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-30'
version: 4
tags: [arc42, initiative, evidence]
---

# Evidence

| ID | Claim | Evidence status |
| --- | --- | --- |
| EVID-038 | one-time claim, fencing, event ordering, duplicate terminal and fail-closed lease recovery | transaction/restart tests pass; packaged launchd daemon recovered in 8 s and retained one stable PID across two 18 s observations |
| EVID-039 | strict Action-role v1 and governance Agent v2 binding/provider contracts | upsert/cleanup, wrong State/Action/role, model/reasoning/network/roots mismatch and zero-dispatch tests pass; Action UI derives provider→model→reasoning and exposes nested Skills plus distinct saves |
| EVID-040 | full strict cut and packaged server+daemon startup | 38 files / 306 tests; arc42/cutover/lint/build/design/diff gates pass; desktop/narrow overflow and console error counts are 0; `make latest` SHA-256 `36fd6a2551ee2c44f776bbbc0b9dd3a7b79cbeb51e9ca00fc844fe98a7072241` created SQLite v19 and a healthy server/daemon pair |
| EVID-041 | ADR-039 shared Action provider/policy strict cut | 38 files / 311 tests; ActionExecutionBindingV2 atomic upsert/cleanup and old route 404; both role mismatches block preflight; v22/v17/v11/v13/v15/v20 gates pass; desktop/narrow page overflow and console errors are 0; v19 archived recoverably; `make latest` SHA-256 `5f71001d7c53cdfac22e03e692816eb79a89c0c4978afb1a936ad5e80cfcdc30` created fresh SQLite v20 with healthy server and both providers ready |

Evidence is updated only from completed commands. A real Codex/Copilot provider occurrence is not claimed by repository tests.
