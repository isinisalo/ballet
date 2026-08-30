---
id: cld-evidence-001
title: Checkout-local daemon evidence
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 2
tags: [arc42, initiative, evidence]
---

# Evidence

| ID | Claim | Evidence status |
| --- | --- | --- |
| EVID-038 | one-time claim, fencing, event ordering, duplicate terminal and fail-closed lease recovery | transaction/restart tests pass; packaged launchd daemon recovered in 8 s and retained one stable PID across two 18 s observations |
| EVID-039 | strict binding/provider contracts and Computer/pairing-free local diagnostics | binding legacy fields rejected, config is 0600, wrong token returns 401, both CLIs ready; Agent/Runtimes browser QA passed at 1440×900 and 390×844 |
| EVID-040 | full strict cut and packaged server+daemon startup | 38 files / 299 tests; arc42/cutover/lint/build/design/diff gates pass; `make latest` created SQLite v18 and healthy server+daemon pair |

Evidence is updated only from completed commands. A real Codex/Copilot provider occurrence is not claimed by repository tests.
