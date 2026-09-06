---
id: arc42-section-04
title: Ratkaisustrategia
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 24
tags: [arc42, solution-strategy]
arc42Section: 4
---

# 4. Ratkaisustrategia

1. Parse strict v26 project truth; keep User Stories and approvals project-local and resolve each Action role to its exact TOML Agent and selected Skills.
2. Freeze every Action Agent definition/hash, role Skill closure and the two fixed read-only governance Agents into Root Snapshot v21 before dispatch, without project-document closure.
3. Select the lowest eligible State order and Action priority transactionally.
4. Let Validation precheck, delegate dynamic Work and postcheck every Work result.
5. Persist state changes and causal Feedback atomically; recover work from durable queue/event facts.
6. Separate Critic and Refinement proposals from trusted human decisions.
7. Apply approved exact refinements in isolated Git worktrees and continue from a new immutable run.
8. Project all control and approval facts through typed HTTP/SSE and responsive UI.

The Codex daemon adapter, strict Action/governance Agent repository, role-derived permissions, worktrees, resource composition, queue/events, SQLite wrapper, HTTP security, SSE and design tokens are generic primitives. The cut contains no compatibility path.
