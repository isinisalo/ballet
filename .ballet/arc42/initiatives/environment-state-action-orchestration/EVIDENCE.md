---
id: environment-state-action-orchestration-evidence
title: Environment State Action orchestration initiative evidence
status: draft
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 4
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
| EVID-028 | REQ-022 / QS-028 | Ordered Environment/State/Action and Validation-led runtime | TEST-028 | pending | phases 02–04/11 | ESAO-evid-003/004 prove isolated contracts and transactions; canonical dispatcher/provider integration is pending. |
| EVID-029 | REQ-022 / QS-029 | Feedback/Critic/approval integrity | TEST-029 | pending | phases 05/08/11 | ESAO-evid-004 proves storage and exact-once decisions; schedule worker and product UI are pending. |
| EVID-030 | REQ-022 / QS-030 | Refinement/apply/continuation/Product Snapshot | TEST-030 | pending | phases 06–08/11 | ESAO-evid-004 proves strict storage/preimage/link invariants; no managed-worktree Git effect has run. |
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
3. Refinement proposals are limited to `.ballet/instructions/**/*.md` and `.agents/skills/**/SKILL.md`; `.ballet/project.json` is rejected by the phase-02 pure scope validator. No broader apply permission is inferred.

These are recorded deviations rather than hidden compatibility behavior. Phase 03 composition and phase 06 refinement work must consume the implemented contracts, and the accepted architecture canon must be reconciled before phase 09 canonicalization if it still states the superseded details.

## Phase 02 strict-v16 inventory and invariants

The isolated v16 inventory is exactly: `metadata`, `environment_runs`, `state_executions`, `action_executions`, `agent_runs`, `control_flow_events`, `product_snapshots`, `feedback_entries`, `critic_schedules`, `critic_runs`, `critic_proposals`, `critic_proposal_decisions`, `refinement_runs`, `refinement_run_feedback`, `refinement_proposals`, `refinement_proposal_files`, `refinement_proposal_decisions`, `refinement_applies`, `continuation_links`, `execution_tasks`, and `execution_events`. It contains no Graph, Reward, policy or acceptance tables.

The tested transaction boundaries create a complete ordered run aggregate; select only one active Action; bind Validation precheck, Work and Validation postwork Agent Runs; make blocked+Feedback indivisible; preserve `maxRetries` as additional attempts; gate State and Environment completion; create the Product Snapshot with terminal Environment status; stop active work without later dispatch; deduplicate Critic due instants; decide Critic and Refinement proposals exactly once against expected hashes; detect stale refinement preimages; and record an applied refinement plus immutable continuation link atomically. Partial unique indexes enforce one active State and Action per Environment and one active Agent per Action. Foreign keys cascade owned aggregate data, while continuation ancestry remains protected.

`VNextConnection` creates only an empty v16 database, reopens a complete v16 inventory, and fails closed for v15, unknown or incomplete inventories with archive/remove guidance. No `ALTER`, copy, reader, alias or dual-write path exists. Current `LocalDatabase` v15 startup is not imported or modified; every v16 test uses a newly created temporary database.

## Open evidence gaps

Canonical runtime, browser, package/install and startup evidence is pending. Test-only Environment/Critic/Refinement records are not product occurrences. No managed-worktree refinement commit or provider-backed continuation Run exists; ESAO-evid-003/004 prove only isolated contracts and persistence.

## Next review basis

The next evidence-producing action is phase 03 immutable resource composition and ExecutionSpec integration under the isolated transition exception.
