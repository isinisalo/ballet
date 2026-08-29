---
id: environment-state-action-orchestration-plan
title: Environment State Action orchestration initiative plan
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 2
tags:
  - arc42
  - initiative
  - plan
---

# Environment State Action orchestration PLAN

## Phase plan and dependencies

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ESAO-step-001 | goal-022 / REQ-022 | QS-032 | adr-034 / CON-015 | BB-008, BB-015 | DEP-005 | audit, Goal/ADR, target/transition/design/trace contracts | `validate:arc42`, DESIGN lint, diff | ESAO-evid-001/002; EVID-032 pending implementation |
| ESAO-step-002 | goal-022 / REQ-022 | QS-028, QS-032 | adr-034 / CON-015 | BB-003, BB-015 | RT-026, DEP-005 | isolated vNext Project Config v20, Direction/Use Case/Environment schemas | contract/property/strict-rejection tests | EVID-028/EVID-032 |
| ESAO-step-003 | goal-022 / REQ-022 | QS-028, QS-030, QS-032 | adr-034 / CON-002, CON-015 | BB-004, BB-005, BB-015 | RT-026, RT-028, DEP-002, DEP-005 | Snapshot v13, fresh SQLite v16, statuses/events/lineage | snapshot/hash/schema/restart/v15-untouched tests | EVID-028/EVID-030/EVID-032 |
| ESAO-step-004 | goal-022 / REQ-022 | QS-028 | adr-034 / CON-003, CON-015 | BB-005, BB-006, BB-015 | RT-026, DEP-002 | Validation precheck, dynamic Work, postwork, retry, provider failure split | state-machine/composition/adapter/fault tests | EVID-028 |
| ESAO-step-005 | goal-022 / REQ-022 | QS-029 | adr-034 / CON-015 | BB-002, BB-005, BB-015 | RT-027, DEP-001 | Feedback v1, Critic schedule/lease/proposal and approval commands | transaction/restart/idempotency/authorization tests | EVID-029 |
| ESAO-step-006 | goal-022 / REQ-022 | QS-030 | adr-034 / CON-001, CON-015 | BB-004, BB-007, BB-015 | RT-028, DEP-002 | read-only proposal, preimages/diff/impact, managed commit, continuation, Product Snapshot | path/security/Git/stale/race/read-model tests | EVID-030 |
| ESAO-step-007 | goal-022 / REQ-022 | QS-028–QS-030, QS-032 | adr-034 / CON-015 | BB-002, BB-015 | RT-026–RT-028, DEP-005 | isolated `/api/vnext` services, approval/refinement boundaries, factual SSE | API/security/concurrency/route inventory tests | EVID-028–EVID-030/EVID-032 |
| ESAO-step-008 | goal-022 / REQ-022 | QS-031 | adr-034 / CON-005, CON-015 | BB-001, BB-015 | RT-026–RT-028, DEP-001, DEP-005 | isolated `/vnext` Direction/Use Cases/Environment/Run/Feedback/Critic/Refinement/Product Snapshot UI | component/a11y/keyboard/1440×900/390×844 browser tests | EVID-031 |
| ESAO-step-009 | goal-022 / REQ-022 | QS-032 | adr-034 / CON-015 | BB-001–BB-006, BB-015 | RT-026–RT-028, DEP-005 | atomic canonicalization; remove old code/routes/tables/tests and vNext prefixes | manifest grep/filesystem/API/build gates | EVID-032 |
| ESAO-step-010 | goal-022 / REQ-022 | QS-031, QS-032 | adr-011, adr-034 / CON-005, CON-006, CON-015 | BB-001, BB-003, BB-008, BB-015 | DEP-001, DEP-003 | strict project data, required instructions, shared Skills, fixtures, release smoke and canonical docs | arc42/design/project-resource/release-smoke tests | EVID-031/EVID-032 |
| ESAO-step-011 | goal-022 / REQ-022 | QS-028–QS-032 | adr-034 / CON-015 | all active target blocks | RT-026–RT-028, DEP-001–DEP-005 | final conformance, full suite, install/startup and clean tree | TEST-028–TEST-032 + repository final gates | EVID-028–EVID-032 |

Dependencies are strict: 01→02→03→04; 03→05; 03/04/05→06; 02–06→07; 07→08; 02–08→09; 09→10→11. Phase 09 is the only canonical switch. No pre-09 phase may make vNext read/write v19 or vice versa.

## Use Case trace

| Use Case | Owning phases | Test type | Stable test/evidence |
| --- | --- | --- | --- |
| UC-01 | 02,10 | schema + architecture trace | TEST-032 / EVID-032 |
| UC-02 | 02,07,08 | domain/API/UI authorization | TEST-029, TEST-031 / EVID-029, EVID-031 |
| UC-03 | 02,08 | schema/property/CRUD/a11y | TEST-028, TEST-031 / EVID-028, EVID-031 |
| UC-04 | 02,08 | schema/property/CRUD/a11y | TEST-028, TEST-031 / EVID-028, EVID-031 |
| UC-05 | 03,07 | immutable snapshot/preflight | TEST-028, TEST-032 / EVID-028, EVID-032 |
| UC-06 | 04 | strict role schema/state machine | TEST-028 / EVID-028 |
| UC-07 | 04 | exact prompt/permission/adapter | TEST-028 / EVID-028 |
| UC-08 | 04 | retry/exhaustion/fault matrix | TEST-028 / EVID-028 |
| UC-09 | 04,05,08 | transaction/restart/read-model/browser | TEST-029, TEST-031 / EVID-029, EVID-031 |
| UC-10 | 05,08 | schedule/lease/approval/UI | TEST-029, TEST-031 / EVID-029, EVID-031 |
| UC-11 | 06,08 | path/preimage/diff/impact/security | TEST-030, TEST-031 / EVID-030, EVID-031 |
| UC-12 | 06,07,08 | Git/stale/race/lineage/API/UI | TEST-030, TEST-031 / EVID-030, EVID-031 |
| UC-13 | 06..08 | factual read model/API/a11y/browser | TEST-030, TEST-031 / EVID-030, EVID-031 |

## Target invariant ownership

| Invariant | Verification owner | Evidence rule |
| --- | --- | --- |
| Approved closure and unique order/priority | shared config + backend preflight | property and negative fixtures; zero tasks on invalid input |
| No premature State progression | runtime coordinator | exhaustive order fixtures and persisted event assertions |
| Derived done/blocked only | shared pure projector + read model | config/schema rejects flags; projection tests cover every status |
| Validation output restrictions | shared role schemas + queue | strict union negative tests; provider prose cannot bypass |
| `1 + maxRetries`, failure split | runtime coordinator | 0/2/5 examples, restart/duplicate/provider failure cases |
| Atomic blocked+Feedback | SQLite/runtime persistence | transaction fault injection and unique causal key |
| Critic proposal human gate | schedule/application service | wrong revision, replay and agent-path denial tests |
| Read-only exact refinement | refinement proposal service | filesystem before/after hash and allowlist/preimage tests |
| One commit/continuation, immutable parent | Git manager + run planner | stale/race/idempotency/snapshot byte checks |
| Shared Skill impact closure | resource catalog + refinement service | reverse-reference property fixtures |
| Active authoring lock | application/frontend | active closure mutation denial and unrelated-resource control |
| Product Snapshot factuality | read model | recomputation equality and forbidden prose-derived fields |
| Responsive/accessibility | frontend/browser | both fixed viewports, keyboard and color-independent labels |
| Strict removal/version cut | conformance/release | manifest gates, v19/v15 fail-closed, packaged startup |

## Risk register

| Risk | Probability/impact | Control and review point |
| --- | --- | --- |
| Cross-namespace accidental read/write | medium/critical | separate types/repos/tables/routes; negative isolation tests every phase; remove in 09 |
| Partial phase 09 cut | medium/critical | one manifest-driven commit; build/API/filesystem/grep gates before phase 10 |
| Approval replay/race | medium/critical | expected revision/hash, unique causal keys and one transaction in phases 05/06 |
| Retry/Feedback duplication on restart | medium/high | idempotent outcome keys and SQLite fault matrix in phases 04/05 |
| Shared Skill unbounded impact | medium/high | reverse-use closure and approval impact display in phase 06/08 |
| Critic loses successful artifacts | high/high in baseline | immutable commit/artifact projection before cleanup in phase 06 |
| Schedule duplicate or starvation | medium/high | durable lease/recovery/clock tests in phase 05 |
| Refinement path traversal/symlink/stale base | medium/critical | strict allowlist, ordinary-file checks, preimages and zero-write failure in phase 06 |
| UI preserves old matrix mental model | medium/medium | target appendix + browser/human review in phase 08/10 |
| Canonical docs claim implementation early | medium/high | status distinguishes accepted target from active v19 until phase 09; evidence remains pending |

## Rollback and compatibility

There is no runtime down migration, compatibility reader, alias or dual-write. Before phase 09, rollback means discard the feature branch or checkout the last pre-cutover commit; isolated vNext data may be deleted because it is not canonical. After local phase 09 validation but before any external write, rollback still means checkout the pre-cutover commit and archive/remove incompatible v16 machine state. No step grants release/deploy authority.

## Legacy and temporary removal

`CUTOVER-MANIFEST.md` is an acceptance input, not optional cleanup. Phase 09 must remove old active control surfaces and all temporary vNext names. Phase 10 must remove old project/release/doc assertions. Historical superseded documents remain.

## Completion definition

“Done” means all five priority-1 QS verdicts have concrete passed evidence, UC-01..UC-13 trace rows are covered, all manifest gates pass, full test/lint/build/arc42/design/release/install/startup checks pass and `git status --short` is empty. Compile alone, a green isolated vNext suite or a partial UI does not qualify.
