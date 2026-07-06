---
title: Loop Engineer Minimal Workflow
createdAt: 2026-07-06
tags:
  - ballet
  - loop-engineer
  - governance
---

# Loop Engineer Minimal Workflow

This project configuration implements the minimum agentic delivery workflow:

1. Brief loop
2. Roadmap loop
3. UI design loop
4. Technical planning loop
5. Milestone + task spec loop
6. Implementation + review + test loop
7. Dev deploy + validation loop

## Governance gates

The workflow intentionally stops after each agent challenge approval and waits for the next human-approved trigger:

| Gate | Human trigger | Meaning |
|---|---|---|
| Gate 1 | `project_brief_approved` | Project Brief accepted. |
| Gate 2 | `roadmap_approved` | Roadmap accepted. |
| Gate 3 | `ui_design_approved` | UI Design accepted. |
| Gate 4 | `technical_plan_approved` | Technical Plan accepted. |
| Gate 5 | `milestones_approved` | Milestones accepted. |
| Gate 6 | `task_specs_approved` | Task Specs accepted; implementation may start. |
| Gate 7 | `code_approved` | Reviewed and tested code accepted; dev deployment may start. |
| Gate 8 | `validate-dev-deployment.approved` | Dev deployment validated. |

No implementation action is reachable from the planning workflows. Implementation starts only from `task_specs_approved`.

## Expected evidence artifacts

Agents should write or update these Markdown artifacts under `.ballet/outputs/` unless the active repository already uses another approved location:

- `.ballet/outputs/PROJECT_BRIEF.md`
- `.ballet/outputs/ROADMAP.md`
- `.ballet/outputs/UI_DESIGN_PLAN.md`
- `.ballet/outputs/TECHNICAL_PLAN.md`
- `.ballet/outputs/MILESTONES.md`
- `.ballet/outputs/TASK_SPECS.md`
- `.ballet/outputs/TRACEABILITY_MATRIX.md`
- `.ballet/outputs/DEPLOYMENT_VALIDATION.md`

## Agent outcome contract

Each agent must return only JSON in this shape:

```json
{
  "outcome": "ready | approved | changes_requested | blocked | failed",
  "summary": "Short decision summary.",
  "artifacts": {
    "documents": [".ballet/outputs/..."]
  },
  "checks": [
    { "name": "check name", "status": "passed | failed | skipped", "details": "evidence" }
  ]
}
```

## Failure routing

`classify-failure` is deliberately conservative. It may send a fixable task-level problem back to `implement-task`. If the failure is actually a task-spec, technical-plan, UI, roadmap, GOALS, or ADR gap, it must return `blocked` and state which earlier human gate must be reopened.
