---
name: quality-scenarios
description: Define and refine measurable arc42 quality scenarios. Use when clarifying quality goals, acceptance measures, evaluation criteria or gaps in section 10 and initiative BRIEFs.
---

# Quality scenarios

For each scenario provide all fields: ID, source, stimulus, environment, affected artifact, expected response, measurable response criterion, priority, evidence and status.

1. Link the scenario to an accepted Goal/requirement and affected architecture IDs.
2. Phrase one observable stimulus and one response under a named environment.
3. Use a criterion that can distinguish pass from fail with a number, exact invariant or zero-tolerance rule.
4. Ask the human for `needs_input` when priority or acceptance measure is not authorized.
5. Keep evidence pending until an actual test/monitor result exists.
6. Add the trace row and verify it with `npm run validate:arc42`.
