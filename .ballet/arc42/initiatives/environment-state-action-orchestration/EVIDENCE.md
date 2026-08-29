---
id: environment-state-action-orchestration-evidence
title: Environment State Action orchestration initiative evidence
status: draft
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 7
tags:
  - arc42
  - initiative
  - evidence
---

# Environment State Action orchestration EVIDENCE

## Evidence records

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| ESAO-evid-001 | audit baseline | Symbol, route, schema, test, project-data, release-smoke and Git baseline audit | `AUDIT.md`, `CUTOVER-MANIFEST.md`; baseline `13d9c8d93acb56d569613aa7aa1bd5027317cce1` | passed | 2026-08-29; `validate:arc42`, diff check before commit `116322db` | Documents baseline facts only; no target behavior. |
| ESAO-evid-002 | goal-022 / REQ-022; QS-028–QS-032 | Goal/ADR/target/transition/trace/design architecture contract and bounded conformance review | `goal-022`, `adr-034`, `TARGET-CONTRACT.md`, `PLAN.md`, 12 arc42 sections, TRACEABILITY, AGENTS and DESIGN | passed: `npm run validate:arc42`; DESIGN lint 0 errors/0 warnings; `git diff --check`; conformance review found 0 unresolved mismatches | 2026-08-29 local repository | Proves documentation consistency only; target implementation evidence remains pending. |
| ESAO-evid-003 | REQ-022; partial QS-028/QS-029/QS-030/QS-032 | Isolated vNext Direction, Environment/State/Action, task/outcome, approval-hash, ordering/gating, refinement-impact and boundary-schema contracts | `shared/vnext/**`; `backend/vnext/domain/*.test.ts` | passed: 59 focused tests; `npm run test` 50 files/240 tests; zero-warning lint; production build; arc42 validation; diff check | 2026-08-29 local repository | Pure contracts only: no loader, DB, HTTP, provider or UI wiring. Does not advance EVID-028..032 to passed. |
| ESAO-evid-004 | REQ-022; partial QS-028/QS-029/QS-030/QS-032 | Isolated strict-v16 schema, stores and transactional flow/review coordinators | `backend/vnext/persistence/**`; `shared/vnext/persistence*.ts` | passed: 23 persistence tests; 7 vNext files/82 tests; `npm run test` 54 files/263 tests; zero-warning lint; production build; arc42 validation; diff check; conformance review found no active-v15, route or frontend coupling | 2026-08-29 temp SQLite databases | Synchronous same-process duplicate/re-entrant evidence only; no claim of a distributed lock, server wiring or provider scheduling. |
| ESAO-evid-005 | REQ-022; partial QS-028/QS-030/QS-032 | Immutable v13 closure planning, six-part v11 prompt, strict v10 output, provider-neutral permissions, Validation-led Environment loop, durable enqueue/reconcile, parent-agent lineage, Product Snapshot and safe continuation seeding | `backend/vnext/runtime/**`; `shared/vnext/runtime.ts`; `agent_runs.parent_agent_run_id`; `TEST-028` integration scenarios 1–18 | passed: 22 runtime/planner/provider tests and complete focused vNext suite; full repository gates recorded in the phase-03 commit | 2026-08-29 deterministic fake provider and temporary v16 databases | Isolated transition namespace only; no public HTTP/startup/frontend registration and no real provider invocation. Managed refinement apply remains phase 05. |
| ESAO-evid-006 | REQ-022; partial QS-029/QS-030/QS-032 | Human/Validation/system Feedback provenance; DST-aware durable Critic scheduling and read-only proposals; exact human decisions; safe-path agentless Refinement apply; shared-Skill impact; immutable continuation and evidence-gated Feedback resolution | `backend/vnext/governance/**`; `backend/vnext/persistence/Review*.ts`; `FeedbackStore.ts`; governance integration tests | passed: disabled/daily/weekly/DST/dedupe/overlap/catch-up/skip/shutdown, approval, target, symlink/preimage/hash/allowlist/Git/continuation/resolution/security scenarios; full repository gates recorded in the phase-05 commit | 2026-08-29 deterministic clock, fake provider boundary, temporary v16 DBs and temporary Git repositories | Local worktrees/branches are intentionally retained for audit; no merge, push, HTTP route or canonical service startup. Real provider occurrence remains pending. |
| ESAO-evid-007 | REQ-022; partial QS-028/QS-029/QS-030/QS-032 | Isolated v20 project/Markdown repositories, reference/blocker index, v16 service composition, 73-route typed HTTP contract, trusted human operations, factual SSE, immutable governance worktree capture and v15/v16 isolation | `backend/vnext/{VNextCompositionRoot.ts,project/**,http/**,runtime/VNextWorkspaceManager*}`; `shared/vnext/{httpContracts,routeInventory}.ts`; API/isolation/workspace tests | passed: API fixture asserts 76 lifecycle/security cases; route inventory equals mounted Express routes; focused suite 8 files/50 tests; full `npm run test` 62 files/320 tests; zero-warning lint; production build | 2026-08-29 temporary v20 project roots, v16 databases, fake provider and local Git worktrees | Transition `/api/vnext` only; current v19 API/UI remain canonical. No browser UI or real provider occurrence is claimed. |
| EVID-028 | REQ-022 / QS-028 | Ordered Environment/State/Action and Validation-led runtime | TEST-028 | pending final cutover | phases 02–04/07/11 | ESAO-evid-003–005/007 prove the isolated contracts, transactions, runtime and API; canonical provider-backed evidence remains pending. |
| EVID-029 | REQ-022 / QS-029 | Feedback/Critic/approval integrity | TEST-029 | pending final cutover | phases 05/07/08/11 | ESAO-evid-004/006/007 prove exact decisions, durable scheduling and HTTP trust boundaries; product UI and real occurrence remain pending. |
| EVID-030 | REQ-022 / QS-030 | Refinement/apply/continuation/Product Snapshot | TEST-030 | pending final cutover | phases 06–08/11 | ESAO-evid-004/006/007 prove managed Git effects, immutable Product-commit capture, continuation and API boundaries; UI/real occurrence remain pending. |
| EVID-031 | REQ-022 / QS-031 | Target responsive/accessibility browser evidence | TEST-031 | pending | future phases 08/10/11 | No target UI exists yet. |
| EVID-032 | REQ-022 / QS-032 | Strict versions, isolation, removal, release/install/startup | TEST-032 | pending | future phases 02–11 | Existing v19 baseline must remain active until phase 09. |

## Relevant decisions

`goal-022`, `adr-034`, `CON-015`, `BB-015`, `RT-026`–`RT-028`, `DEP-005`. The current baseline remains `goal-021` / `adr-033` until phase 09; that is an implementation-status fact, not a competing target decision.

## Evidence policy

ESAO-evid-002 is passed, but it cannot advance EVID-028..032. Full command logs remain transient; this index records exact commands/results and limitations without claiming operational success.

## Phase 02 contract bounds and refinements

The isolated namespace uses independent safety limits rather than copying Graph fixtures: at most 256 Goal/ADR/Constraint items, 128 Use Cases, 128 States, 128 Actions per State, 4,096 Actions per Environment, 64 references or Skills per item, 20 additional Work retries, 50 examples per Use Case, 100,000 instruction characters and 128 proposed files. These bounds cap canonical hashing, issue accumulation, snapshot seeding and provider payload growth while remaining materially above expected authored configurations. Persistence and provider phases must preserve or tighten them at their own trust boundaries.

The phase-02 implementation follows three explicit refinements in the newer authorized prompt where it is narrower or more concrete than `TARGET-CONTRACT.md`:

1. Action instructions require `Task`, `Role`, `Goals`, `Priorities`, `Method`, `Output contract`, `Tool policy` and `Acceptance evidence`; the earlier six-heading target list is not used by the vNext validator.
2. Use Cases use non-empty Given/When/Then examples, success goals, failure goals and expected outcomes plus approved semantic-content hashes; the older title/description/acceptance-criteria draft shape is not retained as a compatibility shape.
3. Canonical Refinement proposals are limited to `.ballet/instructions/**/*.md` and `.agents/skills/**/SKILL.md`; `.ballet/project.json` is rejected. Phase 07 additionally recognizes only the transition equivalents below `.ballet/vnext/{instructions,skills}` and makes the composition select exactly one namespace. No broader apply permission is inferred.

These are recorded deviations rather than hidden compatibility behavior. Phase 03 composition and phase 06 refinement work must consume the implemented contracts, and the accepted architecture canon must be reconciled before phase 09 canonicalization if it still states the superseded details.

## Phase 02 strict-v16 inventory and invariants

The isolated v16 inventory is exactly: `metadata`, `environment_runs`, `state_executions`, `action_executions`, `agent_runs`, `control_flow_events`, `product_snapshots`, `feedback_entries`, `feedback_status_events`, `critic_schedules`, `critic_runs`, `critic_proposals`, `critic_proposal_decisions`, `refinement_runs`, `refinement_run_feedback`, `refinement_proposals`, `refinement_proposal_files`, `refinement_proposal_decisions`, `refinement_applies`, `continuation_links`, `execution_tasks`, and `execution_events`. It contains no Graph, Reward, policy or acceptance tables.

The tested transaction boundaries create a complete ordered run aggregate; select only one active Action; bind Validation precheck, Work and Validation postwork Agent Runs; make blocked+Feedback indivisible; preserve `maxRetries` as additional attempts; gate State and Environment completion; create the Product Snapshot with terminal Environment status; stop active work without later dispatch; deduplicate Critic due instants; decide Critic and Refinement proposals exactly once against expected hashes; detect stale refinement preimages; and record an applied refinement plus immutable continuation link atomically. Partial unique indexes enforce one active State and Action per Environment and one active Agent per Action. Foreign keys cascade owned aggregate data, while continuation ancestry remains protected.

`VNextConnection` creates only an empty v16 database, reopens a complete v16 inventory, and fails closed for v15, unknown or incomplete inventories with archive/remove guidance. No `ALTER`, copy, reader, alias or dual-write path exists. Current `LocalDatabase` v15 startup is not imported or modified; every v16 test uses a newly created temporary database.

## Phase 03 Validation-led runtime evidence

The tested transaction/queue sequence is:

```text
create Environment
  -> select lowest ordered State / lowest priority pending Action
  -> commit Validation precheck Agent + task
  -> enqueue after commit
  -> done | delegate Work(parent=Validation) | atomic blocked+Feedback
  -> Work terminal -> postwork Validation(parent=Work), including Work failed/blocked
  -> done | retry Work(parent=postwork Validation) | atomic blocked+Feedback
  -> all Actions done -> State done -> next State
  -> all States done -> finalization + Product Snapshot
```

Each semantic coordinator transaction creates at most one new dispatch. `agent_runs.parent_agent_run_id` proves Ballet-owned control lineage without provider multi-agent delegation. Queue reconciliation derives pending tasks from v16 and uses an in-memory dedupe boundary; cancellation makes queued tasks ineligible before provider execution. Invalid JSON, wrappers, unknown fields, enum drift and phase drift block the Action with `system_invalid_output` Feedback rather than retrying.

| Action runtime status | Permitted next controller effect | Derived fact |
| --- | --- | --- |
| `pending` | ordered selection only after prior gate | neither done nor blocked |
| `prechecking` | Validation `done \| delegate \| blocked` | neither done nor blocked |
| `working` | Work terminal always queues postwork Validation | neither done nor blocked |
| `postchecking` | Validation `done \| retry \| blocked`; retry exhaustion converts atomically | neither done nor blocked |
| `done` | skipped visibly by continuation/selection; may complete State | `done=true` |
| `blocked` | stops Environment dispatch and owns Feedback provenance | `blocked=true` |

Snapshot v13 contains Project Config/base hashes, full Environment definition, approved Use Case semantic hashes, accepted Goal/ADR/Constraint hashes, execution profiles, preflight capability hashes, full instruction/Skill contents and hashes, exact role permission rows and optional refinement lineage. Its canonical JSON hash is stored with the run. Composition v11 uses exactly: system/role, Action/domain context, hard constraints/approvals, Task Envelope, Skills and exact output requirement. Codex read-only receives no writable root; Work receives only the managed worktree; network remains profile-owned and provider approval is always `never`.

Continuation tests prove that only prior `done` Actions with unchanged definition and relevant resource hashes outside target/impact scope import evidence. Target/impact Actions remain pending, and a changed shared Skill invalidates import for every referencing Action. The parent run is never updated.

## Phase 05 governance evidence

Approval state machines are explicit and provider-inaccessible:

```text
Critic proposal:     pending_human_review --human approve(hash,version)--> approved + Feedback
                                          --human reject(hash,version)--> rejected (no Feedback)

Refinement proposal: pending_human_review --human approve(proposal/change/impact hashes + ack)--> applying
                                          --human reject(exact hash)--> rejected + Feedback open
applying --agentless exact writer--> applied + local commit + continuation
         --preimage mismatch------> stale
         --security/validation----> apply_failed
```

The trusted actor is a separate service argument (`request_context | local_operator`), never an agent-selected source or body role. Feedback rows retain creator, evidence, Critic approval, Refinement proposal and continuation IDs; `feedback_status_events` records human/refinement/continuation transitions. Apply never resolves Feedback. A completed continuation resolves selected `in_refinement` entries; a blocked continuation reopens them.

Critic schedules support bounded daily/weekly local times and IANA timezones. `@js-temporal/polyfill` resolves DST gaps/overlaps deterministically. Persisted `next_due_at`, schedule+instant keys, one active run, at-most-one catch-up, missing-snapshot `skipped`, config-hash replacement and shutdown claim release prevent overlap or restart bursts. Critic and Refinement proposal envelopes are read-only, use immutable Product Snapshot/run closure, and can create only `pending_human_review` proposals.

Refinement changes are full-content `create | replace | delete` operations limited to `.ballet/instructions/**/*.md` and `.agents/skills/**/SKILL.md`. Absolute paths, `..`, `.git`, arbitrary docs/source, secret-like paths and any symlink chain are rejected. A shared Skill change requires every referencing Action in the exact approved impact list. Apply checks operation-specific human authorization, base commit, all preimages before writes, resulting hashes and a fixed validation-command allowlist. It then creates one local `ballet/refinement/*` branch/worktree commit with provenance trailers and persists one immutable continuation. It never invokes a proposal-supplied shell command, merges, pushes or mutates the current checkout. Failures retain the isolated worktree for diagnosis, leave the parent Run/current checkout unchanged and keep Feedback unresolved.

## Phase 07 project, composition and HTTP evidence

The transition source paths are explicit and disjoint: vNext reads/writes `.ballet/vnext/project.json` and `.ballet/vnext/{goals,adrs,constraints,use-cases,instructions,skills}/**`; machine state is `.git/ballet/vnext/state.sqlite`. `VNextProjectRepository` has no v19 fallback and `VNextConnection` has no v15 import. `VNextCompositionIsolation.test.ts` proves byte-level cross-version DB non-interference in both directions, while `VNextProjectPersistence.test.ts` proves explicit-path-only config loading, atomic stable serialization, optimistic hashes, symlink rejection, snapshot locks and reference blockers.

The shared refinement safety predicate recognizes canonical and transition roots for schema-level path rejection, but each composition injects one exact policy. `/api/vnext` permits only `.ballet/vnext/instructions/**/*.md` and `.ballet/vnext/skills/**/*.md`; it rejects canonical v19 resource paths. The API integration commits its vNext authoring baseline, applies an exact replacement to the transition instruction, replans from the refinement commit and verifies that the continuation snapshot contains the approved new resource hash. Phase 09 switches to the canonical policy and removes this transition namespace; there is no dual read or dual write.

```text
server startup
  -> existing v19 composition + /api (unchanged canonical owner)
  -> isolated vNext composition + /api/vnext
       -> strict v20/Markdown repositories
       -> fresh v16 connection and stores
       -> Environment and governance queues reconcile idempotently
       -> enabled valid v20 Critic schedule only
       -> immutable Run worktree / Product commit
       -> temporary detached read-only governance worktree
       -> provider terminal / proposal persistence
       -> governance worktree cleanup
server shutdown
  -> stop new pumping -> cancel/interrupt active work -> release schedule claims -> close v16
  -> existing v19 shutdown remains independently responsible for v15
```

The shared `VNextRouteInventory` contains 73 unique method/path pairs and is compared directly with the mounted Express router in `VNextContractInventory.test.ts`; `VNextSchemaInventory` pins v20/v13/v10/v11/v12/v16 and governance v1. The backend parses every body, query and parameter through shared Zod contracts. POST is create-only, PUT is update-only, stale hashes are 409, missing entities are 404, list/detail evidence is bounded, and no State/Action standalone or body-selected continuation route exists.

Human identity is constructed outside request bodies by the local server boundary (`local_operator:<uid>`); tests inject a trusted `request_context` actor. Use Case, Feedback, Critic and Refinement operations receive that separate actor value. Unknown body fields such as `actor`, `approvedBy`, `source` or arbitrary `patch` fail schema validation. Proposal decisions additionally require the operation-specific content/version/change/impact hashes, so a token or hash cannot authorize a different proposal or effect.

| Mandatory scenario | Stable verification reference |
| --- | --- |
| 1. draft Use Case CRUD | `VNextApi.integration.test.ts`: collection POST, item GET/PUT/DELETE |
| 2. approval hash/actor persisted | API integration: `/use-cases/UC-2/approve`; `VNextProjectPersistence.test.ts` |
| 3. approved semantic edit returns draft | API integration and `VNextProjectPersistence.test.ts` approval invalidation |
| 4. draft blocks start | API integration: draft UC then `POST /environment-runs` 409 |
| 5. State order uniqueness/optimism | API integration: create/get/reorder, duplicate list and stale hash |
| 6. Action priority uniqueness/optimism | API integration: create/get/reprioritize and duplicate list |
| 7. whole Environment start | API integration: optional human input and Environment ID/hash |
| 8. fake provider completion | API integration plus `EnvironmentRuntimeService.test.ts` |
| 9. blocked Run exposes Feedback | API integration blocked fake outcome and Feedback row/read model |
| 10. no standalone State/Action start | API 404 assertion and `VNextProhibitedRoutes` |
| 11. human Feedback source not forgeable | API unknown `actor` rejection and trusted creator assertion |
| 12. Critic proposal is not Feedback | `GovernanceWorkflows.test.ts` pending-proposal/no-Feedback assertion |
| 13. exact Critic approval creates Feedback | API stale-hash rejection then approved Feedback creator/provenance |
| 14. stale/repeated approval denied | API/review 409 and exact-once coordinator tests |
| 15. Refinement proposal writes nothing | `GovernanceWorkflows.test.ts` read-only permission/current-tree assertions |
| 16. exact apply and continuation | API apply/status/link plus managed-worktree continuation tests |
| 17. unsafe refinement path denied | governance symlink/path/preimage tests and arbitrary-patch API 400 |
| 18. active Run authoring lock | API config/resource 409 while immutable Run is active |
| 19. SSE and invalidations | API bounded run-fact and invalidation streams; raw prompt absence |
| 20. restart/reconcile | `EnvironmentRuntimeService.test.ts` and governance durable reconcile tests |
| 21. scheduler enabled/disabled | `GovernanceWorkflows.test.ts` disabled/removal/due/dedupe/claim cases |
| 22. v19 API unchanged | existing repository HTTP/runtime suite remains green; vNext mounts before the unchanged `/api` router |
| 23. vNext never opens/writes v15 | `VNextCompositionIsolation.test.ts` byte-identical v15 assertion |
| 24. v19 never opens/writes v16 | `VNextCompositionIsolation.test.ts` byte-identical v16 assertion |

Successful Run worktrees may be removed after finalization because the Product Snapshot retains the result commit. Before Critic or Refinement execution, `VNextWorkspaceManager` creates a detached read-only worktree at that exact commit and removes it after provider capture. The workspace test proves a newer current checkout is neither read as the approved product base nor rewound. Refinement apply likewise branches from the exact approved reachable Product commit, never from an assumed current `HEAD`.

## Open evidence gaps

Canonical cutover, browser, package/install and real-provider evidence remain pending. Test-only Environment/Critic/Refinement records are not product occurrences. The managed-worktree tests prove local Git and continuation mechanics, but not a production-like provider-backed continuation.

## Next review basis

The next evidence-producing action is phase 08 isolated `/vnext` UI and fixed-viewport accessibility/browser verification under the transition exception.
