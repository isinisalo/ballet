---
name: write-project-intent
description: Write or review project goal and intent documents that let Codex agents work toward a concrete product outcome. Use when creating or editing `.backlog/docs/intent` files, project goals, bounded-context intent, outcome statements, agent decision boundaries, success criteria, or when removing backlog history, migration notes, process filler, and other non-goal content from intent documents.
---

# Write Project Intent

## Core Standard

Write goal and intent documents as an outcome contract for agents. A strong document names the target end state, the context needed to pursue it, constraints that must stay intact, and evidence that shows progress or completion.

Use outcome-first language. Describe what must be true, not the sequence an agent should follow unless a sequence is itself a product constraint.

## Required Shape

Use the smallest set of sections needed. Prefer these:

- `GOAL`: the concrete end state in product terms.
- `INTENT`: why the goal matters and how agents should make decisions toward it.
- `SCOPE`: capabilities or domains included.
- `CONSTRAINTS`: boundaries agents must preserve.
- `EVIDENCE`: observable checks that show the goal is satisfied or still blocked.

For bounded-context intent, `GOAL`, `INTENT`, `CAPABILITIES`, `CONSTRAINTS`, and `EVIDENCE` are usually enough.

## What Belongs

- Product outcomes users or operators would recognize.
- Stable domain boundaries, approved technology boundaries, source boundaries, security boundaries, and compliance stop rules.
- Cross-context dependencies that affect agent decisions.
- Concrete completion evidence: files, tests, user-visible behavior, API behavior, data contracts, or documented blocker evidence.

## What Does Not Belong

Remove these from goal/intent documents:

- Backlog, milestone, task, migration, archive, or reset history.
- Statements about how a document was created, moved, renamed, converted, or cleaned up.
- Task status, implementation plan, ticket dependencies, assignee, priority, or delivery ordering.
- Generic quality claims such as "keep visible", "be clear", "support future work" unless tied to an observable product or agent decision.
- HOW-level details that should live in specs, tasks, implementation notes, code, tests, ADRs, or runbooks.
- Tokenized URLs, credentials, secrets, plaintext tokens, PII, raw external credentials, or source links containing secret query parameters.

## Rewrite Rules

- Replace process history with durable product meaning.
- Replace "create/update/convert this document" with the product condition agents must achieve.
- Convert task lists into capabilities or evidence criteria.
- Keep technology choices only when they are already accepted boundaries.
- Keep external data-source examples only as source intent or adapter constraints, never as token-bearing references.
- Stop and ask if the document would need a new ADR, business rule, retention rule, legal/compliance rule, public API contract, production data source, or credential boundary.

## Self-Review Checklist

Before finalizing, verify:

- A capable agent can tell what outcome to work toward without reading old tickets.
- Every section affects product direction, agent decision-making, constraints, or evidence.
- The document contains no backlog history, migration commentary, or cleanup notes.
- The document distinguishes user-facing outcomes from agent HOW-level detail.
- The document says when to stop rather than guess.
