# User Story acceptance evidence

Verified locally on 2026-09-05. Screenshots use an isolated fixture project with sample stories; they do not contain production project data.

## Visual checks

| View | Desktop, 1440 × 900 | Mobile, 390 × 844 |
| --- | --- | --- |
| Story list | [Screenshot](list-1440x900.png) | [Screenshot](list-390x844.png) |
| Card editor | [Screenshot](editor-1440x900.png) | [Screenshot](editor-390x844.png) |

Verified the Role / Goal / Benefit legend and matching highlights, inline card editing, and all numbered GIVEN / WHEN / THEN criteria beneath each story. Both viewport widths had no horizontal page overflow. Mobile controls were at least 44px high. An unbroken 320-character value grew its textarea without horizontal overflow. Keyboard focus was visible, saved-story focus and the unsaved-change confirmation worked, and reduced-motion emulation reduced transition duration.

The browser created and edited stories through the real HTTP API. Restarting the isolated server retained two stories and three criteria in `.ballet/user-stories/`. Story usage did not populate localStorage or sessionStorage.

## Automated evidence

- `npm run test`: 42 files, 352 tests passed.
- `npm run lint`: no errors; four existing complexity warnings in ActionWorkspace, MarkdownEditor, OrchestrationConfigureOutlet, and RuntimesWorkspace.
- `npm run build`: passed; existing large-bundle warning remains.
- `npm run validate:arc42`: passed.
- `npx @google/design.md lint DESIGN.md`: no errors or warnings.
- `git diff --check`: passed.
- `make latest`: passed after the final code change; installed and restarted Ballet at `http://127.0.0.1:53321`, with server and daemon running and health reporting `ok: true`. The installed `/api/user-stories` endpoint returned HTTP 200.

Focused regression coverage:

- `backend/orchestration/project/UserStoryService.test.ts`: repository roundtrips across service restarts without config creation or SQLite access; Markdown body preservation; stale writes; invalid documents; symlinks; unsafe paths; bounded inputs; active Run locks.
- `backend/orchestration/http/UserStories.integration.test.ts`: real-router CRUD without database access; origin and strict input validation; stale hashes; active Run mutation rejection.
- `frontend/tests/userStories.test.tsx`: all semantic highlights and criteria; complete criterion validation; removal and optional criteria; stale-draft preservation and explicit reload; deliberate deletion; authoring lock; canonical navigation; unsaved-change guard; saved-story focus; invalid-file recovery; save completion after editor unmount.
- `frontend/tests/orchestrationRouting.test.ts`: canonical User Story list/create/edit routes and invalid selection handling.

The full test run initially exposed an existing project-resource assertion that assumed physical State array order. The assertion now verifies canonical `order` values independently of serialization order, preserving the project configuration.
