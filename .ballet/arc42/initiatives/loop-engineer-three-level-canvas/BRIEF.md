---
id: arc42-initiative-loop-engineer-three-level-canvas-brief
title: Loop Engineer three-level canvas BRIEF
status: draft
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - initiative
  - loop-engineer
---

# Loop Engineer three-level canvas BRIEF

## Intent

- **Decision**: `goal-011` authorizes one URL-driven Loop Engineer workspace with Context, Level 1 · Loops and Level 2 · Detail projections.
- **Fact**: the current All Loops card grid and `view=all` special case do not expose project context or Loop Edge topology, while the detail composite layout can render linked Loop summaries.
- Owner: project owner and primary repository architect.
- Stakeholders: Loop author, operator, module installer, reviewer and keyboard/mobile user.

## Scope

Typed routing, pure Context/composition/detail projections, shared Loop Engineer shell, Context canvas, Level 1 Loop graph and inspector, Level 1 Loop Edge editor/orchestrator settings, selected-Loop-only Level 2 canvas, authoritative module-install refresh, software-delivery starter packages, tests, DESIGN and arc42 documentation.

## Non-goals

Project config v11, new runtime entities, nested Loops, drag-to-connect, remote registry, automatic recommended connections, package runtime resolution, full alternate list visualization, theme palette redesign, release, deploy, merge or push.

## Constraints and interfaces

ADR-015, ADR-016 and ADR-017 apply. The frontend reads current `WorkspaceDataDto`, writes only strict-v10 `ProjectAutomationConfig`, and uses the existing module API. Context is honest about missing descriptions/capabilities. Active Runs retain the existing mutation lock.

## Quality goals and acceptance

- QS-002 preserves strict resource/config resolution.
- QS-005 preserves canonical documents and stable trace IDs.
- QS-009 preserves module install/export/provenance and no implicit Loop Edges.
- QS-010 requires deterministic projection/routing tests, keyboard UI coverage and successful 1440×900 plus 390×844 visual verification for all three levels.

## Evidence and authority

Human authority is the repository task dated 2026-08-16, including the locked vocabulary, routes, level responsibilities, starter modules, acceptance criteria and local validation commands. Supporting primary sources are the official arc42 Building Block View, Ballet repository and official OpenAI GPT-5.6 guidance.

## Open questions

No WHAT/WHY, priority, trust or acceptance blocker remains. Future direct manipulation of Loop Edges would need separate interaction design and acceptance evidence.

## Next review basis

Ready for implementation against ADR-017 and PLAN.md. This draft grants no external-write authority.
