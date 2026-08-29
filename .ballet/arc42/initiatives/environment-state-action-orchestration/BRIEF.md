---
id: environment-state-action-orchestration-brief
title: Environment State Action orchestration initiative brief
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 3
tags:
  - arc42
  - initiative
  - orchestration
---

# Environment State Action orchestration BRIEF

## Purpose and decision

Deliver the project-owner-approved strict semantic cut from hierarchical Reward-MDP orchestration to human-directed, approved-Use-Case orchestration whose canonical project hierarchy is Environment → State → Action and whose runtime is Validation-led. `goal-022`, `adr-034` and [TARGET-CONTRACT.md](TARGET-CONTRACT.md) own WHAT/WHY, architecture and bounded target semantics.

## Facts

- **ESAO-F-001:** the baseline is commit `13d9c8d93acb56d569613aa7aa1bd5027317cce1`, strict v19/v4/v7/v12/v9/v10/v11/v5/v15 and Work-first Graph/GraphNode policy runtime.
- **ESAO-F-002:** [AUDIT.md](AUDIT.md) binds exact symbols, routes, tests, project data, release smoke and drift; [CUTOVER-MANIFEST.md](CUTOVER-MANIFEST.md) owns phase/removal surfaces.
- **ESAO-F-003:** the audited baseline had no Critic schedule, Feedback Box, refinement approval/apply or continuation-run domain; the accepted canonical implementation now provides all four.

## Stakeholders and expectations

- Human project owner approves Use Cases, architecture choices, Critic proposals and exact refinement effects.
- Operator sees deterministic ordering, factual gates, blocked Feedback, approvals, continuation lineage and Product Snapshot evidence.
- Validation Agent controls precheck, Work delegation, postwork retry/block and cannot approve proposals.
- Work Agent performs only the delegated dynamic prompt inside immutable permissions.

## Scope

- UC-01..UC-13 in the Target Contract.
- Project Config v20, Snapshot v13, Task/outcome v10, composition v11, ExecutionSpec v12, SQLite v16 and Feedback/Critic/Refinement v1.
- Direction, approved Use Cases, ordered authoring/runtime, human approval commands, exact refinement, immutable continuation and Product Snapshot.
- Isolated phases 02–08, atomic phase 09 canonical cut, project/release/docs phase 10 and full acceptance phase 11.

## Non-goals

No migration, compatibility reader, route alias, dual-write, autonomous human approval, standalone State/Action Run, mutable in-place refinement, merge, push, release or deploy. Historical Goal/ADR/initiative evidence remains in Git.

## Constraints and context interfaces

Preserve checkout-local operation, provider neutrality, ExecutionProfiles, immutable snapshots, managed-worktree isolation, explicit resource composition/hashes, queue/events, strict SQLite replacement, loopback/origin security, factual SSE, tracker reconciliation, external-write authority and existing design tokens. Historical and replacement data remained isolated throughout the transition and were never dual-written.

## Quality goals

- `QS-028`: exact ordering, no premature State progression, Validation-first role restrictions and `1 + maxRetries`.
- `QS-029`: atomic Feedback, Critic schedule idempotency and human-only approval.
- `QS-030`: read-only exact refinement, stale no-write and immutable commit/continuation lineage.
- `QS-031`: factual, keyboard-accessible, overflow-free target UI at 1440×900 and 390×844.
- `QS-032`: exact target versions and zero active legacy or temporary namespace surface after cutover.

All are priority 1. Their complete stimulus/response/criteria live in arc42 section 10; `TEST-028`–`TEST-032` and `EVID-028`–`EVID-032` own verification status.

## Assumptions, findings and open questions

- **Assumption ESAO-A-001:** no production database must be preserved; strict fail-closed replacement is authorized.
- **Finding ESAO-F-004:** successful Run worktree cleanup must be reconciled with Critic-readable immutable artifact evidence in phase 06.
- **Finding ESAO-F-005:** the seven shared arc42 Skills require reverse-impact closure for refinement safety.
- **Open question:** none blocks phases 02–11 inside the accepted Target Contract. Any scope-changing choice returns `needs_input` and requires a new human decision/ADR.

## Acceptance intent and authority

Completion requires every priority-1 QS, UC trace, manifest removal gate, full repository gate, browser viewport, release/install/startup smoke and clean status. Compilation alone is insufficient. The owner's 2026-08-29 prompt series authorized the completed in-scope local implementation, correction, test and documentation commits. Merge, push, release publication and deploy remain unauthorized.
