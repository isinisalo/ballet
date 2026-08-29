---
id: environment-state-action-orchestration-target-contract
title: Validation-led Environment State Action target contract
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 4
tags:
  - arc42
  - initiative
  - target-contract
  - orchestration
---

# Validation-led Environment State Action target contract

## Authority and status

This contract is the canonical active baseline for `goal-022`, `adr-034` and initiative `environment-state-action-orchestration`. It governs the strict v20/v16 implementation. It never authorizes merge, push, release, deploy or external-service writes.

## Project truth and runtime truth

| Truth | Canonical owner | Forbidden duplication |
| --- | --- | --- |
| Direction and approved intent | Git: Goals, ADRs, Constraints and approved Use Cases referenced by Project Config v20 | Provider prompt, SQLite or Product Snapshot cannot redefine WHAT/WHY. |
| Environment authoring | Git: Project Config v20, instructions and skills | Runtime `done`/`blocked`, attempts, approval outcomes or schedule leases never write back as config flags. |
| Execution truth | SQLite v16 + immutable Root Snapshot v13 + execution evidence | Provider prose and UI local state cannot create orchestration facts. |
| Repository effect | Managed-worktree commit SHA and exact artifact hashes | Approval record alone is not a file write; Product Snapshot is not a mutable copy. |

## Target Project Config shape

Project Config v20 is strict and rejects unknown fields. Its semantic shape is:

```text
version: 20
executionProfiles: ExecutionProfile[]
direction:
  goals: [{ id, name, status: draft | accepted | superseded }]
  adrs: [{ id, name, status: draft | accepted | superseded }]
  constraints: [{ id, name, status, kind: required | prohibited, description, rationale, scope? }]
  useCases: [{ id, name, status: draft | approved,
    examples: [{ given, when, then }], successGoals, failureGoals, expectedOutcomes,
    goalIds, adrIds, constraintIds,
    approval?: { approvedBy, approvedAt, revision, contentHash } }]
environment:
  id, name, description,
  states: [{
    id, order, name, description, useCaseIds,
    actions: [{
      id, priority, name, description, useCaseIds, maxRetries, input?,
      validation: { executionProfileId, instructionResource, skillResources, toolPolicy },
      work: { executionProfileId, instructionResource, skillResources, toolPolicy }
    }]
  }]
critic:
  version: 1, enabled,
  schedules: [{ id, kind: daily | weekly, timeZone, localTimes, weekdays? }],
  agent: composition
refinement:
  version: 1, enabled, agent: composition,
  allowedRoots: [`.ballet/instructions`, `.agents/skills`]
```

`order` is a positive integer unique within one Environment. `priority` is a positive integer unique within one State. Gaps are allowed; sort is numeric ascending with ID as a defensive deterministic error-report tie-break only. A duplicate is invalid and cannot start a Run.

## Use Case approval and direction traceability

Only `status = approved` Use Cases with a matching canonical `approval.contentHash` may be referenced by a State/Action or copied into a Root Snapshot. Approval is a human-only command with expected project hash; it records trusted actor, timestamp and monotonic Use Case revision. Editing approved semantic content returns it to `draft`; no silent continued approval. Revocation and subsequent decisions remain immutable audit facts in runtime evidence.

Every State and Action must trace to at least one approved Use Case. Each Use Case carries non-empty Given/When/Then examples, success goals, failure goals and expected outcomes, traces to at least one Goal and cites accepted ADRs/Constraints. Missing, dangling, inactive or unapproved references block snapshot creation with zero provider tasks.

## Thirteen canonical Use Cases

| ID | Human-visible outcome | Target phase | Primary verification type |
| --- | --- | --- | --- |
| UC-01 | Define project Direction. | 02,10 | config/trace schema and arc42 conformance |
| UC-02 | Describe and explicitly approve a Use Case before execution. | 02,07,08 | domain command/API/UI authorization tests |
| UC-03 | Provide architecture decisions to every affected agent role. | 02,03,10 | snapshot/resource/trace tests |
| UC-04 | Model work as one Environment with unique ascending State order. | 02,08 | schema/property/keyboard authoring tests |
| UC-05 | Process State Actions in unique ascending priority without bypass. | 02,04,08 | ordering/gate/runtime/UI tests |
| UC-06 | Define one bounded Action with roles, retries, instructions and Skills. | 02,10 | schema/resource/readiness tests |
| UC-07 | Validation prechecks readiness before Work. | 04 | role schema, evidence and state-machine tests |
| UC-08 | Delegate a bounded dynamic prompt to subordinate Work. | 04 | composition/permission/provider adapter tests |
| UC-09 | Retry within `1 + maxRetries` or block with atomic Feedback. | 04,05,08 | transaction/restart/read-model/browser tests |
| UC-10 | Form a factual terminal Product Snapshot. | 06..08 | finalization/read-model/API/a11y tests |
| UC-11 | Run scheduled read-only Critic and retain a proposal only. | 05,08 | schedule lease/idempotency/UI tests |
| UC-12 | Human-approve criticism into append-only Feedback. | 05,07,08 | approval/transaction/API/UI tests |
| UC-13 | Human-approve exact Refinement and create an immutable continuation Run. | 06..08 | Git/hash/stale/race/lineage/browser tests |

## Ordering and gate invariants

1. Runtime selects the lowest-order State whose Actions are not all `done`.
2. Within it, runtime selects the lowest-priority Action not `done`.
3. Only one semantic controller transition for an Action is committed at a time; duplicate outcomes are idempotent no-ops or exact conflicts.
4. No Action in a later State may enter `validating_precheck` while any earlier-State Action is not `done`.
5. Any `blocked` Action derives State `blocked = true` and Environment `blocked = true`; dispatch stops until a later approved refinement creates a continuation snapshot or an explicitly designed future unblock command is accepted by a new ADR.
6. Empty State is invalid. Empty Environment is invalid. No implicit done is inferred from absence.

## Action runtime status machine

Persist exactly one source status from:

```text
pending
→ prechecking
→ done
| blocked
| working → postchecking
                       → done
                       | working
                       | blocked
```

Operational task status (`queued | running | waiting_for_input | succeeded | failed | cancelled | interrupted`) remains separate. Derived booleans are pure:

```text
action.done    = action.status == done
action.blocked = action.status == blocked
state.done     = every action.done
state.blocked  = any action.blocked
environment.done    = every state.done
environment.blocked = any state.blocked
```

No boolean is persisted in project config or accepted from a provider.

## Validation precheck and postwork outputs

Precheck v10 is a strict union:

- `done`: summary, checks and evidence refs proving the Action already satisfies its criteria; no Work task is created.
- `delegate`: summary, checks and non-empty `workPrompt`; runtime snapshots the exact prompt/hash and creates one Work attempt.
- `blocked`: summary, checks, reason code, evidence refs and Feedback content; runtime atomically blocks the Action and appends Feedback.

Postwork v10 is a strict union:

- `done`: summary, checks and evidence refs; runtime marks Action done and may select the next priority Action.
- `retry`: summary, checks, feedback and expected correction; allowed only while additional attempts remain.
- `blocked`: summary, checks, reason code, evidence refs and Feedback content.

Validation cannot name another State/Action, approve a Use Case/proposal, alter schedule state, choose a repository path outside refinement or emit arbitrary status strings.

## Work outcome restrictions

Work v10 returns only:

- `completed`: summary, checks and artifact/evidence references; or
- `needs_input`: one bounded question/context that pauses and resumes the same Work attempt.

Work cannot return `done | retry | blocked`, patch orchestration State, append Feedback, approve/reject anything, choose a next target or claim Product Snapshot facts. Provider failure/cancel/interruption bypasses semantic retry and produces an operational failure boundary for Validation/operator handling; it does not consume `maxRetries` unless a completed Work is postchecked as `retry`.

## Retry formula and examples

Let `r = maxRetries`, a non-negative integer. Total allowed Work attempts are `1 + r`. A postwork `retry` after attempt `a` creates attempt `a + 1` iff `a <= r`. Otherwise the same transaction records Action `blocked` and one exhaustion Feedback entry.

| `maxRetries` | Allowed Work attempts | Exhaustion point |
| ---: | ---: | --- |
| 0 | 1 | retry after attempt 1 blocks |
| 2 | 3 | retries after attempts 1 and 2 delegate; retry after 3 blocks |
| 5 | 6 | retry after attempt 6 blocks |

Restart, duplicate provider terminal and repeated approval requests cannot exceed the formula or duplicate Feedback.

## Execution permission matrix

| Actor/role | Project read | Managed worktree write | Active checkout write | Network | Approval command | External write |
| --- | --- | --- | --- | --- | --- | --- |
| Validation pre/post | snapshot/resource read | read-only | no | only selected profile | no | no |
| Work | snapshot/resource read | yes, within workspace policy | no | only selected profile | no | no unless separately authorized outside this contract |
| Critic | Product Snapshot/artifact read | read-only | no | only selected profile | no | no |
| Refinement proposer | allowed-path/preimage read | read-only | no | only selected profile | no | no |
| Refinement apply service | exact approved patch read | deterministic allowed-path write | no | no | consumes recorded approval only | no |
| Human operator | UI/API read | through typed commands | no direct implicit write | n/a | yes with expected revision/hash | only a separate exact authorization |

The provider cannot widen ExecutionProfile permissions, read outside snapshot/resource roots or write service credentials.

## Feedback Box contract v1

Feedback entries are append-only facts:

```text
{ version: 1, feedbackId, sourceKind: action_blocked | critic_approved,
  environmentRunId?, stateId?, actionId?, criticProposalId?,
  summary, details, evidenceRefs, createdAt, createdBy }
```

Action blocking and its Feedback insert share one SQLite transaction and unique causal key. Critic proposal approval and Feedback insert share one transaction and unique proposal ID. Rejection or unapproved proposal creates no Feedback. Resolution is a separate append-only event/refinement lineage, never destructive editing of the entry.

## Critic contract v1

Config schedule v1 is disabled by default and contains bounded daily/weekly schedules with unique local `HH:mm` values, an IANA `timeZone` and unique ISO weekdays for weekly cadence. Machine-local schedule facts have `nextDueAt`, lease owner/expiry, last start/completion and monotonic revision. At most one Critic execution is leased per Environment. Restart recovers an expired lease and dispatches at most one due catch-up occurrence, never replaying a completed occurrence.

Critic reads the latest immutable Product Snapshot and retained artifact/commit evidence. It writes neither repository nor Feedback. Its immutable proposal contains proposal ID, source Product Snapshot/hash, findings, evidence refs, createdAt and status `proposed | approved | rejected | expired`. Human approve/reject commands require expected proposal revision. Approval appends one Feedback entry atomically; it does not directly refine config.

## Refinement contract v1

Proposal states are `proposed | approved | rejected | stale | applying | applied | failed`. Apply may start only from `approved`. Proposal generation is read-only and stores:

- `baseCommitSha`, source Run/Product Snapshot and config/resource closure hash;
- exact unified diff bytes and SHA-256;
- every changed path plus preimage SHA-256 (`ABSENT` sentinel for a new file);
- rationale, expected validation and affected Use Case/State/Action IDs;
- shared Skill reverse-impact closure listing every Action that references a changed Skill.

Allowed paths are only:

- `.ballet/instructions/**/*.md`;
- `.agents/skills/**/SKILL.md`.

Symlinks, path traversal, `.git/**`, `.tickets/**`, source code, lockfiles, Goals, ADRs, arc42, DESIGN, AGENTS and release files are forbidden. A new architecture decision is authored through the normal human-directed project workflow, not automated refinement.

Apply verifies base commit, approval revision, diff hash, all preimages, allowlist and shared Skill impact before any write. It uses a new managed worktree, applies exact bytes, validates Project Config v20/resource/instruction contracts, commits once and records commit SHA. Any mismatch writes no repository files and marks proposal stale/failed with evidence.

## Continuation-run semantics

An applied refinement creates exactly one continuation Run using the refinement commit as immutable base. Snapshot v13 adds `{ parentRootRunId, refinementProposalId, refinementApprovalId, refinementCommitSha }`. The continuation starts at the first non-done Action needed under the new approved closure, using explicit carried factual evidence references; it never mutates/reopens the parent Run or copies provider prose as State. Idempotency is keyed by applied proposal ID.

Successful Run work must remain Critic-readable through an immutable commit/artifact projection even after transient worktree cleanup. Failed sparse worktrees remain diagnostic under the existing bounded lifecycle.

## Product Snapshot

Product Snapshot is a read-only projection with version, source Run/snapshot/commit/config/resource hashes, approved Use Case revisions, ordered State/Action runtime statuses and derived gates, attempts, Feedback refs, Critic/refinement/approval lineage, changed artifacts and validation evidence. It is recomputable from canonical stores and contains no invented progress, ETA, elapsed duration, dialogue or provider-derived status.

## API approval boundaries

Canonical target API exposes explicit commands for Use Case approve/reject, Critic proposal approve/reject and Refinement proposal approve/reject. Each body contains expected revision and relevant content/preimage hash; server authentication is the existing loopback/same-origin human UI boundary. Agent task tokens/outputs cannot call approval services.

A durable Work `needs_input` boundary uses `POST /api/environment-runs/:runId/work-input`. Its body is bound to the exact active Work Agent ID and revision plus the bounded human answer; a stale or cross-Agent response is rejected and cannot consume a retry or create a new Work attempt.

Refinement apply is an internal/application command that consumes an already recorded approval; no public route accepts “approved=true” plus a diff. All mutations use Zod validation, exact conflict errors and one transaction. Canonical endpoints live under `/api`; there are no aliases.

## UI routes and responsive contract

Canonical workspaces are Direction, Use Cases, Environment, Run Gate, Feedback Box, Critic Review, Refinement Approval and Product Snapshot. Each has one route owned by the shared route inventory and frontend routing contract.

The Environment view uses ordered lanes/sections and priority Action rows/cards, not freeform topology. Action detail shows Validation as main, Work subordinate and retry/block states. Approval commands expose exact revision/hash impact, require deliberate confirmation, remain keyboard reachable and never rely on color alone. Acceptance at 1440×900 and 390×844 is page overflow 0, clipped core action 0 and full keyboard/focus flow. Existing dark palette, Inter/Geist, spacing/radii and signal colors remain.

## Required instruction sections

Every selected Action-role instruction must contain exactly these top-level sections in this order, with role-appropriate non-empty content:

1. `## Task`
2. `## Role`
3. `## Goals`
4. `## Priorities`
5. `## Method`
6. `## Output contract`
7. `## Tool policy`
8. `## Acceptance evidence`

Validation instructions describe precheck/postwork restrictions. Work instructions state subordinate scope and forbidden approval/routing. Critic/Refinement instructions state read-only proposal authority. Missing, duplicate or reordered sections block config/resource readiness with zero provider tasks.

## Active-run authoring lock

While a Run or continuation using a snapshot is active, mutation is disabled for its approved Use Cases, Environment/States/Actions, referenced instructions/skills/profiles and relevant Critic/refinement source closure. Inspection, navigation, Feedback review and human response at an explicit waiting boundary remain available. A separate unrelated resource may be edited only if reverse references prove it outside every active closure.

## Strict removal criteria

The implementation must satisfy [CUTOVER-MANIFEST.md](CUTOVER-MANIFEST.md): the removed architecture and every transitional prefix are absent from active source, configuration, routes and tests. Historical superseded docs and initiative evidence remain. Project Config versions other than v20 and SQLite versions other than v16 are rejected unchanged; no migration, reader, alias or dual-write exists.

## Target version matrix

| Contract | Target |
| --- | ---: |
| Project Config | 20 |
| Root Snapshot | 13 |
| Task Envelope / role outcome | 10 / 10 |
| Prompt composition | 11 |
| ExecutionSpec | 12 |
| SQLite | 16 |
| Feedback | 1 |
| Critic | 1 |
| Refinement | 1 |
| Decision Model / policy / acceptance ledger / Graph Node Module | removed |

## Verification ownership

| Invariant group | Owner | Stable verification |
| --- | --- | --- |
| Config, approvals, ordering and strict versions | shared/backend contract owners | `TEST-028`, `TEST-032` |
| Validation loop, retry, gate and Feedback atomicity | runtime/persistence owners | `TEST-028`, `TEST-029` |
| Critic schedule and human approval | runtime/application owners | `TEST-029` |
| Refinement/hash/apply/continuation/Product Snapshot | Git/runtime/read-model owners | `TEST-030` |
| Routes, authoring lock, accessibility and responsive UI | frontend/browser owners | `TEST-031` |
| Removed-surface gate, release fixture/install/startup | conformance/release owners | `TEST-032` |

“Done” requires executable evidence for every in-scope priority-1 criterion, not compilation alone.
