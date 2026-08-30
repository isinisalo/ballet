---
name: test-driven-development
description: Execute Ballet's split test-first and implementation Actions with truthful red-to-green evidence and minimal architecture-conformant changes.
---

# Test-driven development

Use the current Action to select one boundary; never combine them silently.

1. **Write Tests:** link each test to an accepted requirement, quality scenario or invariant. Change only tests and necessary test support. Run the smallest targeted command and confirm it fails because the intended behavior is missing—not because of syntax, setup, fixtures or an unrelated regression.
2. Report that result as expected **red evidence**, including the exact command, test name and failure reason. Never call the failing test or full suite passed, and never skip or weaken it to make the repository green between Actions.
3. **Write Code:** reproduce or inspect the recorded red evidence, implement the smallest correct behavior, and keep changes within accepted architecture and design boundaries.
4. Run the targeted test until green, then the success and failure-path regressions and all checks required by affected `AGENTS.md` files.
5. Refactor only when the green behavior is preserved and the refactor is necessary for the bounded change. Retain exact red, green and regression evidence separately.
