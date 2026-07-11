---
title: Loop Engineer Minimal Loop
createdAt: 2026-07-06
tags:
  - ballet
  - loop-engineer
  - governance
---

# Loop Engineer Minimal Loop

This project configuration implements nine focused delivery Loops:

1. `project-brief`
2. `roadmap`
3. `ui-design`
4. `technical-plan`
5. `milestones`
6. `task-specs`
7. `implementation-review`
8. `dev-deployment`
9. `ci-validation-recovery`

Each Loop owns its Steps and starts at its declared `start` Step. Agent Steps may move only within that Loop or end its Run. Only a human Step may start another Loop as a linked Run. Every Loop also supports a direct manual start with optional free-form input.

## Governance gates

The primary delivery chain waits at a human Step before another Loop starts:

| Gate | Approved Transition | Meaning |
|---|---|---|
| Gate 1: `project-brief-gate` | `roadmap` | Project Brief accepted. |
| Gate 2: `roadmap-gate` | `ui-design` | Roadmap accepted. |
| Gate 3: `ui-design-gate` | `technical-plan` | UI Design accepted. |
| Gate 4: `technical-plan-gate` | `milestones` | Technical Plan accepted. |
| Gate 5: `milestones-gate` | `task-specs` | Milestones accepted. |
| Gate 6: `task-specs-gate` | `implementation-review` | Task Specs accepted; implementation may start. |
| Gate 7: `code-gate` | `dev-deployment` | Reviewed and tested code accepted; dev deployment may start. |
| Gate 8: `dev-deployment-validation-gate` | `completed` | Dev deployment accepted and its Run completed. |

A human response requires both an `approved` or `rejected` result and non-empty input. Rejection follows the gate's Loop-local rework Transition. No planning agent Step can reach implementation directly; implementation begins from the human-approved `task-specs-gate` Transition or a manual `implementation-review` Run.

## Step and Transition contract

Every Step declares both `on.approved` and `on.rejected`. A target is one of:

- another Step ID in the same Loop;
- `{ "loop": "..." }` on a human Step only; or
- `{ "end": "completed|blocked|failed" }`.

Failures that can be corrected safely stay within the active Loop. Failures that require reopening an earlier specification or governance decision end the Run as `blocked` and state which earlier gate must be revisited.

The `dev-deployment` and `ci-validation-recovery` Loops each contain their own classification, implementation, test, review, and human-gate Steps. Their remediation agents never jump to `implementation-review` or another Loop. An approved `ci-validation-remediation-gate` starts a linked `dev-deployment` Run so the corrected build is deployed and validated through the normal human-gated path.

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
  "outcome": "ready | approved | changes-requested | blocked | failed",
  "summary": "Short decision summary.",
  "artifacts": {
    "documents": [".ballet/outputs/..."]
  },
  "checks": [
    { "name": "check name", "status": "passed | failed | skipped", "details": "evidence" }
  ]
}
```

The Run engine maps `ready` and `approved` to the Step's `approved` Transition. It maps `changes-requested`, `blocked`, and `failed` to the Step's `rejected` Transition.

## Run modes

- **Edit** changes and validates the saved Loop definition. Editing is locked while that Loop has an active Run.
- **Run** starts a manual Run, shows the current or latest snapshot graph, accepts a human response, and cancels an active Run.
- Each cycle through a Step creates a new Step Run, preserving the full rework history.
- Only one active Run may exist for a Loop. A human cross-Loop Transition waits if the target Loop is already active.
- A root Run chain stops as `blocked` after 20 Step transitions.
