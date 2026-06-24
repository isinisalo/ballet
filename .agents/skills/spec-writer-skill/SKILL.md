---
name: spec-writer-skill
description: Write concise, agent-oriented specifications, AGENTS.md instructions, Backlog tasks, acceptance criteria, implementation plans, and governance docs for Codex agents. Use when drafting or editing specs, agent instructions, project rules, or execution guidance; avoid narrative human-facing prose.
---

# Spec Writer Skill

Use this skill when writing or editing:

- Specifications, governance docs, ADR-like guidance, and project rules.
- `AGENTS.md` instructions and other agent-facing operating rules.
- Backlog task descriptions, acceptance criteria, implementation plans, and final summaries.
- Instructions that another Codex agent must execute without extra interpretation.

## Output Contract

- Preserve the target language. Use the surrounding document language when editing an existing file; otherwise use the user's requested language.
- Write for Codex agents, not human storytelling. Optimize for executable constraints, defaults, interfaces, validation, and stop conditions.
- Prefer dense, explicit requirements over motivation. Include rationale only when it changes an agent decision.
- Use imperative, testable language. Finnish examples: "Tee", "Älä tee", "Kun..., silloin...", "Agentti saa...", "Agentti ei saa...".
- Keep each paragraph purposeful. It must constrain behavior, define an interface, state a decision, set a default, or define validation.

## Structure

Use the smallest structure that makes the instructions unambiguous:

1. Purpose: one short paragraph only if it changes how the agent should act.
2. Rules: required behavior, forbidden behavior, allowed defaults, and escalation conditions.
3. Interfaces: paths, commands, schemas, APIs, inputs, outputs, and ownership boundaries.
4. Acceptance: testable criteria, validation commands, examples, and completion checks.

For acceptance criteria, prefer stable `GIVEN ... WHEN ... THEN ...` clauses or equivalent testable bullets.

## Rewrite Rules

- Convert vague intent into explicit defaults and stop/ask conditions.
- Replace narrative background with operational facts.
- Remove duplicated rationale, marketing language, conversational filler, and generic quality claims.
- Keep lists parallel: each bullet should express one decision, requirement, or check.
- Prefer exact names, paths, dates, tools, and status values when known.
- State unknowns as blockers only when the agent cannot safely choose a low-risk default.

## Self-Check

Before finalizing agent-facing text, verify:

- The trigger terms and scope are explicit enough for another agent to know when to apply the text.
- The language matches the target document or user request.
- Every requirement is observable, testable, or tied to a concrete decision.
- No paragraph exists only to sound persuasive, contextual, or polished.
- The text tells the next agent what to do, what not to do, what to assume, and when to stop.
