---
id: arc42-section-04
title: Ratkaisustrategia
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 22
tags: [arc42, solution-strategy]
arc42Section: 4
---

# 4. Ratkaisustrategia

1. Parse strict v23 project truth and close approved Use Cases only from each owning State with accepted Goals, ADRs and Constraints.
2. Freeze Action role model/reasoning selections and the two fixed read-only Codex governance Agents into Root Snapshot v18 before dispatch.
3. Select the lowest eligible State order and Action priority transactionally.
4. Let Validation precheck, delegate dynamic Work and postcheck every Work result.
5. Persist state changes and causal Feedback atomically; recover work from durable queue/event facts.
6. Separate Critic and Refinement proposals from trusted human decisions.
7. Apply approved exact refinements in isolated Git worktrees and continue from a new immutable run.
8. Project all control and approval facts through typed HTTP/SSE and responsive UI.

The Codex daemon adapter, Action role selections, fixed governance Agent repository, worktrees, resource composition, queue/events, SQLite wrapper, HTTP security, SSE and design tokens are generic primitives. The cut contains no compatibility path.
