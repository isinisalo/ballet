---
id: architecture-root
title: Ballet architecture entrypoint
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 20
tags:
  - architecture
  - arc42
---

# Ballet architecture

Ballet is a checkout-local orchestration command center. Its canonical architecture is the accepted Environment -> State -> Action model in [`adr-034`](.ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md), with the full contract in the [`environment-state-action-orchestration`](.ballet/arc42/initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md) initiative.

## Truth boundaries

- Project truth is version-controlled Markdown, `.ballet/project.json`, instructions and Skills.
- Machine-local truth is fresh SQLite v16 under `.git/ballet`, immutable run snapshots, events and managed worktrees.
- Runtime status is authoritative; `done` and `blocked` are derived facts.
- UI and providers project facts. They do not own ordering, approval or retry decisions.

## Runtime architecture

```text
Human-approved direction
  -> strict Project Config v20
  -> immutable Root Snapshot v13
  -> Environment Run
  -> lowest-order eligible State
  -> lowest-priority eligible Action
  -> Validation precheck
       -> done
       -> delegate -> Work -> Validation postwork -> done | retry | blocked
       -> blocked
  -> next State only after every prior Action is done
  -> Product Snapshot
```

Validation controls the loop. `maxRetries` counts additional Work attempts after the first. Exhaustion persists the blocked Action and Feedback entry in one transaction. Provider failure is a technical outcome and never silently becomes a semantic retry.

Critic and Refinement are separate governance flows. A Critic proposal requires a human decision before it can become Feedback. A Refinement proposal is read-only and exact-hash-bound; approval applies only allowed instruction/Skill paths in a managed worktree, creates one commit and starts an immutable continuation run.

## Building blocks

| Block | Responsibility | Source |
| --- | --- | --- |
| Shared contracts | Strict schemas, version constants, status derivation, route contracts | `shared/orchestration/**` |
| Project services | v20 config and Markdown closure | `backend/orchestration/project/**` |
| Runtime | planning, Validation-led control, provider dispatch and continuation | `backend/orchestration/runtime/**` |
| Persistence | SQLite v16 transactions, events, schedules, feedback and reviews | `backend/orchestration/persistence/**` |
| Governance | Critic, human approvals and Refinement apply | `backend/orchestration/governance/**` |
| HTTP/SSE | loopback-secured canonical `/api/*` boundary | `backend/orchestration/http/**` |
| UI | canonical configure, run, feedback, review and product workspaces | `frontend/src/orchestration/**` |
| Provider/worktree primitives | provider-neutral execution and local Git isolation | `backend/execution/**` |

## Strict version matrix

| Contract | Version |
| --- | ---: |
| Project Config | 20 |
| Root Snapshot | 13 |
| Task Envelope / role outcome | 10 |
| Prompt composition | 11 |
| ExecutionSpec | 12 |
| SQLite | 16 |
| Feedback / Critic / Refinement | 1 |

There is no migration, compatibility reader, route alias or dual write. Incompatible local databases must be archived or removed.

## Canonical documentation

- [arc42 index](.ballet/arc42/README.md)
- [status](.ballet/arc42/STATUS.md)
- [traceability](.ballet/arc42/TRACEABILITY.md)
- [quality scenarios](.ballet/arc42/10-quality-requirements.md)
- [design system](DESIGN.md)

Historical initiatives and superseded ADRs remain audit evidence, not active architecture.
