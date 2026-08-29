---
id: environment-state-action-orchestration-evidence
title: Environment State Action orchestration initiative evidence
status: draft
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 10
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
| ESAO-evid-008 | REQ-022; partial QS-028/QS-029/QS-031 | Isolated vNext Configure UI for Direction, Use Cases, ordered Environment/State/Action authoring, resources, profiles and Critic configuration | `frontend/src/vnext/{configure/**,authoringModels.ts,vNextApi.ts,useVNext*}`; `frontend/tests/vnext{AuthoringModels,Routing,ConfigureUi}.test.*`; `evidence/configure-{environment-1440x900,action-390x844}.png` | passed: 39 focused tests; real API browser snapshots at 1440×900 and 390×844; overflow 0; URL back/forward preserved Action deep link; keyboard reorder and color-independent status inspected | 2026-08-29 local loopback service | Configure half of phase 08 only. Run/Feedback/review/Product UI and final target verdict remain pending. |
| ESAO-evid-009 | REQ-022; partial QS-028–QS-031 | Isolated vNext Environment Run gate, Validation/Work timeline, Feedback, Critic and Refinement exact-approval review, continuation and Product Snapshot UI | `frontend/src/vnext/{run/**,runModels.ts,runTypes.ts,useVNextGovernanceData.ts}`; `frontend/tests/vnext{RunModels,GovernanceUi,Routing}.test.*`; `evidence/run-gate-{1440x900,390x844}.png` | passed: 53 focused tests; built-browser factual fixture at 1440×900 and 390×844; page overflow 0; narrow controls at least 40 px; 0 console errors/warnings; no old-domain text | 2026-08-29 local loopback service with bounded browser-only Run facts | Browser fixture is not a provider-backed product occurrence. Canonical routes and final quality verdict remain phase 09/11 work. |
| ESAO-evid-010 | REQ-022 / QS-028–QS-032 | Atomic canonical cutover, strict removal, responsive canonical UI, packaged release smoke and local install/startup | `shared/orchestration/**`, `backend/orchestration/**`, `frontend/src/orchestration/**`, `scripts/check-cutover-removal.mjs`, `evidence/canonical-{environment-1440x900,action-390x844}.png` | passed: 27 files/254 tests; zero-warning lint; production build; 219-file removal gate; arc42/design/diff checks; packaged v20/v16 API smoke; `make latest`; healthy launchd service | 2026-08-29 local checkout, deterministic fake providers and real production bundle browser | No merge, push, release or deploy. A production-like real-provider continuation remains future operational evidence, not a cutover blocker. |
| EVID-028 | REQ-022 / QS-028 | Ordered Environment/State/Action and Validation-led runtime | TEST-028 | passed locally | phases 02–04/07/09/11 | strict schema, planner, transaction, runtime, API and fake-provider completion/blocking tests plus ESAO-evid-010. |
| EVID-029 | REQ-022 / QS-029 | Feedback/Critic/approval integrity | TEST-029 | passed locally | phases 05/07–09/11 | atomic/restart/schedule/approval/API/UI tests plus ESAO-evid-010. |
| EVID-030 | REQ-022 / QS-030 | Refinement/apply/continuation/Product Snapshot | TEST-030 | passed locally | phases 06–09/11 | safe-path/hash/impact/Git/lineage/API/UI tests plus ESAO-evid-010. |
| EVID-031 | REQ-022 / QS-031 | Target responsive/accessibility browser evidence | TEST-031 | passed canonical | phases 08–11 | canonical browser deep links, back/forward, invalid IDs, 0 overflow, 40 px narrow controls and 0 console errors/warnings. |
| EVID-032 | REQ-022 / QS-032 | Strict versions, isolation, removal, release/install/startup | TEST-032 | passed locally | phases 02–11 | strict rejection tests, removal gate, full repository gates, packaged smoke, local install and healthy startup. |

## Relevant decisions

`goal-022`, `adr-034`, `CON-015`, `BB-015`, `RT-026`–`RT-028`, `DEP-005`. These now describe the active canonical implementation.

## Evidence policy

ESAO-evid-003–009 preserve the isolated build phases as historical evidence. ESAO-evid-010 is the canonical cutover record. Full command logs remain transient; this index records exact commands/results and limitations without turning deterministic fake-provider checks into a real-provider product occurrence.

## Historical phase 02 contract bounds and refinements

The isolated namespace uses independent safety limits rather than copying Graph fixtures: at most 256 Goal/ADR/Constraint items, 128 Use Cases, 128 States, 128 Actions per State, 4,096 Actions per Environment, 64 references or Skills per item, 20 additional Work retries, 50 examples per Use Case, 100,000 instruction characters and 128 proposed files. These bounds cap canonical hashing, issue accumulation, snapshot seeding and provider payload growth while remaining materially above expected authored configurations. Persistence and provider phases must preserve or tighten them at their own trust boundaries.

The phase-02 implementation follows three explicit refinements in the newer authorized prompt where it is narrower or more concrete than `TARGET-CONTRACT.md`:

1. Action instructions require `Task`, `Role`, `Goals`, `Priorities`, `Method`, `Output contract`, `Tool policy` and `Acceptance evidence`; the earlier six-heading target list is not used by the vNext validator.
2. Use Cases use non-empty Given/When/Then examples, success goals, failure goals and expected outcomes plus approved semantic-content hashes; the older title/description/acceptance-criteria draft shape is not retained as a compatibility shape.
3. Canonical Refinement proposals are limited to `.ballet/instructions/**/*.md` and `.agents/skills/**/SKILL.md`; `.ballet/project.json` is rejected. Phase 07 additionally recognizes only the transition equivalents below `.ballet/vnext/{instructions,skills}` and makes the composition select exactly one namespace. No broader apply permission is inferred.

These are recorded deviations rather than hidden compatibility behavior. Phase 03 composition and phase 06 refinement work must consume the implemented contracts, and the accepted architecture canon must be reconciled before phase 09 canonicalization if it still states the superseded details.

## Historical phase 02 strict-v16 inventory and invariants

The isolated v16 inventory is exactly: `metadata`, `environment_runs`, `state_executions`, `action_executions`, `agent_runs`, `control_flow_events`, `product_snapshots`, `feedback_entries`, `feedback_status_events`, `critic_schedules`, `critic_runs`, `critic_proposals`, `critic_proposal_decisions`, `refinement_runs`, `refinement_run_feedback`, `refinement_proposals`, `refinement_proposal_files`, `refinement_proposal_decisions`, `refinement_applies`, `continuation_links`, `execution_tasks`, and `execution_events`. It contains no Graph, Reward, policy or acceptance tables.

The tested transaction boundaries create a complete ordered run aggregate; select only one active Action; bind Validation precheck, Work and Validation postwork Agent Runs; make blocked+Feedback indivisible; preserve `maxRetries` as additional attempts; gate State and Environment completion; create the Product Snapshot with terminal Environment status; stop active work without later dispatch; deduplicate Critic due instants; decide Critic and Refinement proposals exactly once against expected hashes; detect stale refinement preimages; and record an applied refinement plus immutable continuation link atomically. Partial unique indexes enforce one active State and Action per Environment and one active Agent per Action. Foreign keys cascade owned aggregate data, while continuation ancestry remains protected.

`VNextConnection` creates only an empty v16 database, reopens a complete v16 inventory, and fails closed for v15, unknown or incomplete inventories with archive/remove guidance. No `ALTER`, copy, reader, alias or dual-write path exists. Current `LocalDatabase` v15 startup is not imported or modified; every v16 test uses a newly created temporary database.

## Historical phase 03 Validation-led runtime evidence

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

## Historical phase 05 governance evidence

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

## Historical phase 07 project, composition and HTTP evidence

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

## Historical phase 08 Configure UI evidence

The isolated route inventory implemented and tested in this increment is:

```text
/vnext/configure/direction
/vnext/configure/use-cases
/vnext/configure/environment
/vnext/configure/environment/states/:stateId
/vnext/configure/environment/states/:stateId/actions/:actionId
/vnext/configure/resources/instructions
/vnext/configure/resources/skills
/vnext/configure/execution-profiles
/vnext/configure/critic
```

`WorkspaceShell` branches before any v19 data or event hook mounts. The vNext branch owns `/api/vnext` fetch/mutation modules, bounded factual SSE invalidation, refresh-safe local form state, optimistic server hashes and one navigation blocker; it imports no backend or v19 API module. Pure modules own URL parsing/building, State/Action reorder, approval invalidation projection, readiness grouping, shared-Skill impact and schedule normalization. Components own rendering, local draft state and event forwarding.

Use Case approval opens a separate confirmation containing the exact semantic hash/revision; Save remains draft content mutation. Action authoring labels Validation as main/controller twice in the control projection and Work as subordinate, exposes `1 + maxRetries`, exact instruction requirements and the read-only/workspace-write permission split. The checked browser snapshots show the same content stacked at 390×844, zero page overflow and exact textual statuses. The initial narrow audit found a 28 px compact control; the local retry added a vNext-scoped 40 px minimum and 16 px form text rule before acceptance. No palette or shape token changed.

## Historical phase 08 Run and governance UI evidence

The Run workspace starts only a complete Environment and projects persisted States by ascending `order` and Actions by ascending `priority`. It derives the current gate from the first unfinished Action, labels Validation as main and Work as subordinate, renders retries as `first + maxRetries`, and exposes no standalone State/Action start or force-done control. Blocked Actions link to factual Feedback while later States remain visibly gated.

Critic and Refinement reviews keep proposals read-only until a separate confirmation. Critic decisions send the exact proposal hash/version and describe the one-Feedback consequence. Refinement decisions send the proposal hash, sorted file hashes and exact impacted Action IDs; approval additionally requires acknowledgment of one local commit and immutable continuation Run. The UI never sends replacement bytes in an approval request. Apply progress/failure, continuation linkage, evidence-gated Feedback resolution and Product Snapshot provenance remain separately visible.

The governance data hook uses only `/api/vnext`, refreshes from bounded invalidation events and preserves component-local drafts across refreshes. Duplicate row reconciliation is stable-ID based. Invalid Run, Feedback, Critic, Refinement and Product deep links fail closed with recovery controls. Component/model/route tests cover the 23 required workflow/security states; the focused set contains 53 passing tests.

Browser QA used the production bundle and a bounded Playwright route fixture only for Run/governance facts; project/configuration requests continued to the isolated local `/api/vnext` service. At 1440×900 and 390×844, page/body horizontal overflow was 0, the narrow minimum interactive height was 40 px, factual statuses remained text-visible without color, old Graph/MDP language was absent, and the browser console contained 0 errors/warnings. The screenshots are `evidence/run-gate-1440x900.png` and `evidence/run-gate-390x844.png`.

## Open evidence gaps

The strict cutover, package/install/startup and canonical browser gates passed locally. One production-like real-provider Environment occurrence and continuation remain open operational evidence; deterministic fake-provider and managed-worktree tests are not represented as that occurrence.

## Next review basis

The next evidence-producing action is a separately authorized real-provider Environment occurrence followed by independent review of its persisted Product Snapshot and continuation lineage. Merge, push, release and deploy remain outside this initiative authorization.
