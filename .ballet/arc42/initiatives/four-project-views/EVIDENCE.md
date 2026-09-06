---
id: four-project-views-evidence
title: Four Project views verification
status: accepted
createdAt: '2026-09-06'
updatedAt: '2026-09-06'
version: 1
tags: [evidence, project, approval]
---

# Four Project views verification

Fact — Verified locally on 2026-09-06 in the working tree based on `caacde54ec9cf8a01375884f033fb2617f7807fe`. [ADR-048](../../../adr/adr-048-four-project-views.md) records the user's authorized contract. This evidence concerns implementation, not human agreement to the converted stories.

## Delivered contract and source integrity

Project navigation is exactly Overview → Event Storming → User Stories → ADRs. Overview is one Markdown file; each story is one Markdown file with structured Role/Goal/Benefit, ordered GIVEN/WHEN/THEN criteria, ADR references, body and approval metadata. ADRs are read directly from Markdown. Project Config contains no parallel project description, document inventory or Direction model. Replaced UI routes and API collections have no aliases or legacy readers.

The [unchanged source archive and conversion map](../../../history/project-definition-2026-09-06/README.md) records each old source and its SHA-256. Eight functional Use Cases became eight new stories; five execution/context scopes became shared requirements. Goals and Constraints were redistributed by meaning into [Overview](../../../overview.md), stories and references to existing ADR/design contracts. The source checkout had no existing User Story documents or Event Storming model to convert. Historical approvals retain their original bytes. All eight repository stories and both fixture stories remain **Draft, revision 0, without approval metadata**.

Project Config, Root Snapshot and SQLite changed only because removal changes their persisted shapes; [the active matrix](../../../../ARCHITECTURE.md#active-version-matrix) owns the versions. Environment → State → Action ordering, Validation/Work retries and runtime authority are unchanged. Stories and approvals add no Run gate, snapshot closure or automatic prompt injection. The existing active-Run authoring lock remains.

## Commands and measured results

All commands below completed successfully. [Retained command output](validation.txt) contains the test/build/lint/validator/design logs and package/startup output.

| Command | Result |
| --- | --- |
| `npm run test` | 51 files, 390 tests passed; latest full run at 08:40:16 Europe/Helsinki, 4.14 s |
| `npm run lint` | ESLint with the script's `--max-warnings=0`; exit 0 |
| `npm run build` | TypeScript and Vite production build passed, also rebuilt by `make latest` |
| `npm run validate:arc42` | 12 sections, 117 document IDs, five States and 21 Actions validated |
| `npm run validate:cutover` | Strict removal gate passed; 571 files scanned |
| `npx @google/design.md lint DESIGN.md` | 0 errors, 0 warnings; one informational token summary |
| `git diff --check` | No whitespace errors |
| `make latest` | Native arm64 release build, package smoke, local install, server restart and status passed |
| `ballet status` and local HTTP/UI reads | Installed service healthy on port 53321; daemon online, Codex ready, zero active tasks; canonical configuration and eight Draft stories readable |

The incompatible machine-local database was archived under `.git/ballet/archive/schema-v23-before-four-project-views-20260906` before startup. The package smoke uses a fresh database and the converted compact fixture. No real provider task, publication or remote deployment was required for this authoring change. Existing longer provider recovery/continuation evidence retains its separately dated scope.

## Executable coverage (TEST-046)

`npm run test` executes these specific checks alongside the existing runtime, HTTP security, persistence, Event Storming and UI suites:

| Invariant | File and exact test name |
| --- | --- |
| One story file and restart round-trip | `backend/orchestration/project/UserStoryService.test.ts` — `roundtrips ordered criteria across service restarts without creating config or accessing SQLite` |
| Presentation-equivalent approval | Same file — `stores approval only in the story and preserves it across YAML and Markdown presentation edits` |
| Every semantic field invalidates approval | Same file — `invalidates %s edits and keeps revision monotonic across reapproval` (Role, Goal, Benefit, criteria, details); `validates ADR references before saving and invalidates approval when references change` |
| Safe external edits and human boundary | Same file — `detects external semantic edits and refuses stale file or semantic hashes without rewriting the file`; `rejects injected approval metadata and a non-human service actor` |
| Complete semantic hash | `backend/orchestration/project/userStoryApproval.test.ts` — `binds references, criterion order, link destinations, code and all prose`; `ignores reference set order and approval metadata, without stripping meaningful structure` |
| Real HTTP actor and stale commands | `backend/orchestration/http/UserStories.integration.test.ts` — `requires explicit human approval of the persisted file and semantic hash` (trusted `local_operator` source) |
| Overview round-trip, config independence, ADR writes and removed-route 404s | `backend/orchestration/http/Api.integration.test.ts` — `enforces 83 project, run, feedback, review, routing, and security scenarios` |
| No approval or project-document Run gate | `backend/orchestration/runtime/EnvironmentRunPlanner.test.ts` — `plans a Run without project document or story approval inputs`; existing ordering, retry and snapshot tests |
| Archive integrity and unapproved conversion | `.ballet/tests/defaultProjectResources.test.ts` — `retains original bytes and approval provenance while converted stories remain unapproved` |
| Exact navigation | `frontend/tests/orchestrationConfigureUi.test.tsx` — `lists exactly the four Project views in canonical order` |
| Preserved full cards | `frontend/tests/userStories.test.tsx` — `highlights all three parts and always displays every GIVEN / WHEN / THEN criterion` |
| Explicit approval and preserved stale draft | Same file — `requires an explicit saved-content confirmation and disables approval for a dirty or stale draft`; `keeps the draft after a stale approval response and does not retry against a refreshed hash` |
| Markdown conflicts and new ADR editor | `frontend/tests/markdownConflicts.test.tsx` — `preserves a resource draft and blocks stale saves until explicit reload`; `keeps the new ADR editor open when Create clears an existing selection` |

Hash equivalence is deterministic CommonMark structure and normalized plain field whitespace. It covers YAML spelling, CRLF, soft line wrapping, equivalent heading/list markers and ADR set order. It does not infer that rewritten prose means the same thing. Link destinations, code, ordered criteria, IDs, all meaningful prose and Markdown structure remain approval-sensitive. Current file-byte hashes independently reject stale writes even when semantic hashes are equal.

## Real browser verification

Fact — Headed Chromium was operated through Playwright at **1440×900** and **390×844**. Mutation exercises used an isolated copy at `/tmp/ballet-four-views-qa`, port 4328. The final Overview and eight-story card screenshots use the installed service on port 53321. Screenshots were visually inspected; the narrow views were also checked for page overflow and visible target bounds.

| View or flow | Observed result and screenshot |
| --- | --- |
| Navigation | Four Project entries in order, mobile navigation opens and selects views. [Mobile navigation](../../../../output/playwright/navigation-mobile.png) |
| Overview | UI save and reload retained content. Cancelled dirty navigation retained the edit. External file edit followed by focus refresh exposed a conflict, disabled saving and kept the local draft until explicit discard/reload. [Desktop](../../../../output/playwright/overview-desktop.png), [mobile](../../../../output/playwright/overview-mobile.png) |
| Story cards | Eight canonical Draft cards; full colored Role/Goal/Benefit and numbered GIVEN/WHEN/THEN remain. Narrow text wraps with document width 390 px. [Desktop](../../../../output/playwright/stories-desktop.png), [mobile](../../../../output/playwright/stories-mobile.png) |
| Story authoring and approval | Created separate QA story `7cac23fb-3b83-42e7-a44e-e38236aa2547`, saved fields/criteria/details/ADR, approved with keyboard Tab/Enter, reloaded and observed `local-operator:501`, timestamp, revision 1 and semantic hash. Only this test story was approved. YAML quoting/list-marker edits kept Approved; a role edit returned Draft. [Editor](../../../../output/playwright/story-editor-mobile.png), [approval details](../../../../output/playwright/story-approval-mobile.png), [mobile confirmation](../../../../output/playwright/story-approval-dialog-mobile.png), [desktop confirmation](../../../../output/playwright/story-approval-desktop.png) |
| Stale approval | Opened confirmation, changed the QA file externally, then confirmed. Server returned 409; draft remained, approval disabled and explicit current-content recovery available. [Conflict](../../../../output/playwright/story-conflict-desktop.png) |
| Event Storming | Created Big Picture board and two notes, edited details and `sources`, duplicated a note, linked them, used undo/redo, keyboard F2/ArrowRight, resized and dragged a placement. Reload/API read retained notes, sources, edge and geometry. Reused the same note on a Process Modeling board (two-board usage); Software Design level remained available. [Overview](../../../../output/playwright/event-storming-overview-mobile.png), [desktop canvas](../../../../output/playwright/event-storming-desktop.png), [mobile canvas](../../../../output/playwright/event-storming-mobile.png) |
| ADRs | Created and saved `adr-qa` in the isolated project, reloaded its YAML/body, and exercised Create while an existing ADR was selected. Keyboard save and both layouts worked. [Desktop](../../../../output/playwright/adrs-desktop.png), [mobile](../../../../output/playwright/adrs-mobile.png) |
| Removed routes | `/project/goals`, `/project/constraints` and `/project/use-cases` show Workspace unavailable at their original URL, without redirect aliases |

The new mobile detail summaries measure 40 px high; Back is 40×44 px and the observed save/approve buttons are 44 px high. The approval dialog fits the narrow viewport and Escape closes it. Existing Event Storming pan/zoom and its horizontally scrollable palette retain their interaction model. Its implementation files are unchanged in this delivery.

Finding resolved — Browser QA caught a mismatch between the approval service's accepted actor source and the server's actual trusted local-operator source. Both service and HTTP regression coverage were corrected. ADR creation now retains the editor when clearing a prior selection; new mobile detail controls meet the design target. Required tests and the package build were rerun after these code corrections.

## Completion boundary

No requested local validation remains blocked. The eight converted project stories still require the project owner's individual semantic review and explicit approval; this implementation evidence does not grant it. No independent agent review or real provider execution is claimed by this delivery. No merge, push, publication or deployment was performed.
