---
id: event-storming-workspace-evidence
title: Repository-owned visual Event Storming verification
status: review
createdAt: '2026-09-05'
updatedAt: '2026-09-05'
version: 1
tags: [arc42, event-storming, evidence]
---

# Event Storming verification — EVID-044

Scope: the explicitly approved local Project → Event Storming plan, ADR-046 and QS-044. The workspace uses the existing React Flow dependency and one `.ballet/event-storming/model.md`. No board-specific runtime, SQLite table, Config payload or Root Snapshot payload was added. Config and ten project-local agent instructions now refer to the canonical model instead of the three previous level documents.

## Automated evidence

| Check | Evidence and outcome |
| --- | --- |
| Shared identities, independent layouts and restart | `backend/orchestration/project/EventStormingService.test.ts`: shared notes survive a new service instance; two board layouts remain independent. Missing files return `absent` without creating directories. |
| Strict file safety | The service suite rejects duplicate IDs, missing references, incompatible versions, nonfinite geometry, unsafe paths, symlink files/ancestors, aliases and oversized models. Invalid source bytes remain unchanged. Stable serialization preserves the Markdown body and passes a 500-note model. |
| HTTP and SQLite boundary | `backend/orchestration/http/EventStorming.integration.test.ts`: GET/PUT exercise the real router/controller/repositories with SQLite. The only SQL statement is the existing `SELECT` for the active Run lock. Zero SQLite writes; model.md is the only created project file. PUT emits one transient invalidation. Real active Run status blocks writes and permits reads. Hostile origins, extra fields/queries, oversized bodies and stale hashes are rejected. |
| Save queue and recovery | `frontend/tests/eventStorming.test.ts`: 600 ms typing debounce, immediate geometry commits, serial writes, newer draft fencing, persistent undo/redo, external-refresh races, hash conflicts, invalid source drafts, temporary Run locks and independent board operations. |
| Canvas typing and keyboard | `frontend/tests/eventStormingUI.test.tsx`: real React Flow canvas retains every typed character across renders and updates two placements of one note. Escape/F2 focus and source-reference edits are verified. |
| Navigation and invalidations | `workspaceNavigation.test.tsx` preserves dirty drafts between boards and blocks leaving the editor. `orchestrationInvalidations.test.tsx` verifies that effect cleanup closes EventSource connections, preventing connection exhaustion after workspace changes. |

## Browser evidence

Playwright exercised an isolated Git project with a local server, never a production workshop file. The fixture represents a checkout/order workshop; its domain statements are test examples.

- Created Big Picture, derived Process Modelling and then Software Design through the UI. Text changed through a shared note and remained shared across all three levels.
- Added events, actors and aggregates by palette and keyboard; verified immediate text focus, Escape, F2, arrow-key movement and Delete. Pointer resizing gave live geometry feedback, persisted on release and was restored by Undo. The connection dialog also completed with keyboard focus, typing, Tab and Enter.
- Created named connections through the connection dialog, selected multiple notes, moved a group, created/named a frame, moved its members and deleted only the frame. Undo/redo restored the corresponding model edits.
- Found shared notes and their board occurrences, used **Add existing** to create a second placement on the same board, inspected all affected boards in **Delete everywhere**, deleted and restored the shared note with Undo.
- Edited model.md directly outside the editor, refreshed the UI and recovered from a now-missing placement URL. A second direct file edit caused a real stale-hash save conflict. The local draft remained visible, navigation was blocked when the discard prompt was dismissed, the draft copied to the clipboard, and explicit reload restored repository content.
- A 500-note board (168,963-byte complete model document) rendered in **336 ms** from board selection. Editing and saving one event completed in **932 ms**, including the 600 ms debounce. Pan and zoom worked. These are one local development-browser smoke measurement, not a cross-device performance guarantee.
- At **1440×900** and **390×844**, the canvas remained within the workspace. On narrow screens, header controls were 40×40 px, selection tools occupied the bottom strip and the board stayed pannable. Mini map, fit view, visible selection/focus and reduced-motion mode were checked. The narrow workspace bounds were x=0, y=56, width=390, height=788.

Visual artifacts:

- [Big Picture, 1440×900](evidence/big-picture-1440x900.png)
- [Process Modelling, 1440×900](evidence/process-1440x900.png)
- [Process Modelling, 390×844](evidence/process-390x844.png)

## Repository and installed build

| Command / probe | Final result, 2026-09-05 |
| --- | --- |
| `npm run validate:arc42` | Passed: 12 sections, 115 document IDs, Project Config v25, 5 States, 21 Actions. Includes optional strict model validation. |
| `npm run validate:cutover` | Passed: 602 files scanned. Previous active level-artifact path references removed, including Action inputs in Project Config. |
| `npm run test` | Passed: 46 files, **375 tests**. |
| `npm run lint` | Passed with 0 errors and 4 pre-existing complexity warnings outside Event Storming. |
| `npm run build` | Passed. Existing large-chunk advisory remains. |
| `npx @google/design.md lint DESIGN.md` | Passed: 0 errors/warnings; 65 color tokens. |
| `git diff --check` | Passed. |
| `make latest` | Passed: local arm64 release built and installed; Ballet restarted successfully. |
| Installed health / daemon | `ballet status`: server running, health `ok: true`, daemon `online`, zero active tasks. Checkout `/Users/iiro.sinisalo/git/ballet`, URL `http://127.0.0.1:53321`, server started `2026-09-05T08:14:56.547Z`. |
| Installed Event Storming | GET returned v1 empty model, hash `absent`; browser exposed all three levels and enabled Create Big Picture. Opening the workspace did not create model.md. [Installed workspace](evidence/installed-1440x900.png). |

The isolated QA server was stopped before installation. No remote push, merge or publication was performed.

## Limits

This evidence covers the approved local editor and file compatibility with existing Work/Validation agents. It does not claim a stakeholder workshop, a dispatched agent Run, real-time multiplayer or a human visual acceptance verdict. Concurrent external edits use document-wide optimistic conflicts; automatic merging, AI chat and image/PDF export remain outside the approved first version.
