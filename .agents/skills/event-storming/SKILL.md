---
name: event-storming
description: Read bounded project context and refine a shared semantic process map with optional responsibility information.
---

# Event Storming

Event Storming is optional project context, not a required lifecycle stage or an executable workflow.

1. Read [MODEL.md](MODEL.md). Work in the current checkout or your own managed worktree. Run `ballet context event-storming --json` for the small process/story index; do not load the full map or every story as routine context.
2. Use the current Action input's optional `eventStormingTarget` object, containing exactly one `processId` or `storyId`, or an explicit target in the delegated task. Run `ballet context event-storming --process <id> --json` or `ballet context event-storming --story <id> --json`. Unknown IDs are errors. If relevant work needs a target and several fit, ask for bounded input. Missing optional modeling is not a Run gate.
3. Validation reads the projection, inspects source hashes and carries the resolved target and the required read command into its bounded Work prompt. Work executes that command from its own worktree before changing related files. Postwork Validation rereads the same target and independently checks evidence. Record the target, command and source hashes in the existing outcome evidence.
4. Preserve all relevant alternate/failure paths, policies, external dependencies and questions. Stories are sources, not a mechanical command/event generation language. Draft evidence is exploratory; story approval approves neither the map nor implementation. Never approve stories or claim assumptions as accepted decisions.
5. Work changes only the targeted process and its related concepts/references. Before editing a shared concept, inspect its other process usages: the authorized scope must cover its semantic impact. Preserve unrelated IDs and layouts. Reusing a concept creates a new process step; moving a card changes only layout.
6. Write uncertain domain knowledge as an explicit open question (a hotspot concept). Do not invent stakeholder evidence. Use ordinary named connections and textual conditions, not executable expressions. Aggregates and responsibility boundaries are optional and are never inferred from visual groups.
7. Validate with `npm run validate:arc42` and the checks required by the affected repository boundary. Re-run the targeted context command; report exact commands, changes, source hashes and unresolved issues. Model and layout writes use separate optimistic hashes and atomic replacements. No source approval, SQLite mirror or new canonical projection document is created.
