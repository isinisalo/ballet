---
id: environment-state-action-orchestration-cutover-manifest
title: Environment State Action orchestration cutover manifest
status: draft
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags:
  - arc42
  - initiative
  - cutover
  - manifest
---

# Environment State Action orchestration cutover manifest

## Phase map

| Phase | Planned responsibility |
| --- | --- |
| 02 | Isolated vNext Environment/State/Action project contracts and validation. |
| 03 | Snapshot v13 and fresh SQLite v16 persistence. |
| 04 | Validation-led Action runtime, retry and state gates. |
| 05 | Feedback Box, Critic schedule/proposals and approval commands. |
| 06 | Read-only refinement, exact diff/hash approval, managed-worktree apply and continuation Run. |
| 07 | vNext application services and `/api/vnext` boundary. |
| 08 | `/vnext` responsive UI and authoring/run approval flows. |
| 09 | Atomic canonical cutover, legacy removal and vNext prefix removal. |
| 10 | Strict project fixtures, instructions/skills, release smoke and canonical documentation. |
| 11 | Full conformance, scale, browser, package/install/startup and clean-tree gates. |

## Surface manifest

| Path/pattern | Owner layer | Current responsibility | Target responsibility | Action | Phase | Verification | Removal gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shared/domain/automation.ts` | shared domain | Graph/GraphNode/ActionNode, Work/Validation, retry | Environment/State/Action and Validation-led roles | replace | 02 | contract/schema unit tests | legacy symbols 0 in phase 09 |
| `shared/domain/projectConfig.ts` | shared domain | strict Project Config v19 | strict Project Config v20 | replace | 02 | v20 valid; v19 rejected | vNext type namespace canonicalized in 09 |
| `shared/api/workspace-schemas.ts` | shared API | v19 authoring schemas/policy preview | v20 Direction/Use Case/Environment schemas | replace | 02 | boundary Zod matrix | `/api/vnext` consumers moved in 09 |
| `shared/domain/decisionModel*.ts` | shared domain | Reward-MDP config/runtime/Q/V/ledger | no target responsibility | remove | 09 | absence grep + TypeScript build | active imports 0 |
| `shared/api/decision-model-schemas.ts` | shared API | Decision Model v4 schema | no target responsibility | remove | 09 | route/schema absence tests | policy preview 0 |
| `shared/domain/graphNodeModules.ts` | shared domain | Module v7 package/catalog contract | no target responsibility | remove | 09 | package symbol/path absence | packages/catalog 0 |
| `shared/api/graph-node-module-schemas.ts` | shared API | Module v7 request/schema boundary | no target responsibility | remove | 09 | API 404/route inventory | module routes 0 |
| `shared/domain/runtime.ts` | shared runtime | Graph State, node invocations and Work-first outcomes | State/Action runtime status and derived done/blocked | replace | 03..04 | state-machine/property tests | vNext aliases 0 in 09 |
| `shared/domain/runtimeOrchestration.ts` | shared runtime | policy/control-flow events | ordered state/action/approval/refinement events | replace | 03..06 | event exhaustive tests | old event enums 0 |
| `shared/domain/runs.ts` | shared runtime | Graph/GraphNode root and policy projection | Environment Run, continuation and Product Snapshot | replace | 03..06 | run DTO tests | root kind aliases 0 |
| `shared/domain/executionRuntime.ts` | shared execution | Snapshot v12, composition v10, spec v11 | Snapshot v13, composition v11, spec v12 | adapt | 03..06 | immutable hash/roundtrip tests | temporary vNext fields 0 in 09 |
| `shared/domain/taskEnvelope.ts` | shared execution | Task Envelope v9 Work/Validation | Validation-controller/Work v10 | replace | 04 | schema/order/retry examples | v9 producers/consumers 0 |
| `shared/api/runtime-schemas.ts` | shared API | node outcomes, root kinds, policy/ledger DTO | Action/Feedback/approval/refinement v1 DTO | replace | 03..06 | Zod negative/positive tests | legacy schemas 0 |
| `shared/api/task-envelope-schemas.ts` | shared API | Work-first v9 role schema | Validation-led v10 role schema | replace | 04 | pre/postwork restriction tests | v9 schema 0 |
| `shared/api/workspace-contracts.ts` | shared API | exports all active Graph/module/policy DTOs | exports only canonical target DTOs | replace | 07..09 | frontend boundary build | vNext export names 0 in 09 |
| `backend/project-config/**` | backend config | load/normalize/write v19 Graph | strict read/write v20 Environment | replace | 02 | v19 fail-closed; no normalization reader | vNext repo removed/renamed 09 |
| `backend/automation/**` | backend authoring | Graph config repository/validation | Environment authoring repository/validation | replace | 02,07 | CRUD/reference/lock tests | old service imports 0 |
| `backend/policy/**` | backend policy | compile/preview/admissibility/reward | no target responsibility | remove | 09 | absence grep + tests removed/replaced | directory absent or no active policy code |
| `backend/runs/GraphExecutionPlanner.ts` | backend runs | Graph target snapshot/policy compilation | Environment snapshot and approved Use Case closure | replace | 03 | snapshot determinism tests | filename/symbol removed 09 |
| `backend/runs/LocalRunTargetService.ts` | backend runs | Graph/GraphNode run readiness | Environment run readiness only | replace | 07 | target API tests | standalone State/Action target count 0 |
| `backend/runs/LocalRunService.ts` | backend runs | start/persist/enqueue/finalize Graph roots | Environment/continuation lifecycle | adapt | 03..07 | end-to-end state gate tests | old root kinds 0 |
| `backend/runs/RootRunStore.ts` | backend persistence | v12 Graph root snapshot mapping | v13 Environment/continuation mapping | replace | 03 | strict snapshot mapper tests | v12 reader 0 |
| `backend/runs/RunReadProjection.ts` | backend read model | Graph/policy current position | Environment/State/Action/Feedback/Product Snapshot | replace | 07 | factual projection tests | policy fields 0 |
| `backend/runtime/RuntimeDecisionDispatcher.ts` | backend runtime | compiled policy dispatch | deterministic next pending priority Action | replace | 04 | ascending order tests | policy dispatch symbol 0 |
| `backend/runtime/RuntimeFlowCoordinator.ts` | backend runtime | Work→Validation→policy loop | Validation precheck→Work→postwork loop | replace | 04 | all state/retry/block paths | vNext coordinator canonicalized 09 |
| `backend/runtime/RuntimePolicyStore.ts` | backend persistence | policy/ledger facts | no target responsibility | remove | 09 | table/store absence | file/import 0 |
| `backend/runtime/RuntimePolicyTransition.ts` | backend runtime | branch/reward/acceptance transition | no target responsibility | remove | 09 | branch/reward absence | file/import 0 |
| `backend/runtime/RuntimeInvocationStore.ts` | backend persistence | GraphNode/ActionNode/Node runs | State/Action/role attempts | replace | 03..04 | transaction/idempotency tests | old table names 0 |
| `backend/runtime/RuntimeTaskEnvelopeBuilder.ts` | backend execution | v9 Work/Validation envelopes | v10 controller/subordinate envelopes | replace | 04 | exact bytes/context tests | v9 references 0 |
| `backend/runtime/{RuntimeEventStore,RuntimeStateStore}.ts` | backend persistence | Graph control events and JSON State | ordered runtime facts and immutable state evidence | adapt | 03..06 | restart/no-duplicate tests | graph-specific vocabulary 0 |
| `backend/runtime-db.ts` | backend facade | Graph/policy/ledger store composition | target store composition | replace | 03..06 | integration tests | old store members 0 |
| `backend/storage/RuntimeSchema.ts` | backend persistence | SQLite v15 policy/Graph schema | fresh SQLite v16 target schema | replace | 03 | table inventory + v15 untouched | legacy tables 0 |
| `backend/storage/LocalDatabase.ts` | backend persistence | strict v15 opener | strict v16 opener | adapt | 03 | new DB + v15 fail-closed | migration statements 0 |
| `backend/integration/TaskEnvelopeV9.ts` | backend integration | canonical v9 serialization | canonical v10 serialization | replace | 04 | hash/size/parser tests | filename/v9 imports 0 |
| `backend/execution/ExecutionComposition.ts` | backend execution | composition v10 and outcome v9 | composition v11 and outcome v10 | adapt | 04 | exact resource/prompt/hash tests | V10/V9 markers 0 |
| `backend/execution/ExecutionSpecSchema.ts` | backend execution | ExecutionSpec v11 | ExecutionSpec v12 | adapt | 04 | persisted spec parsing | v11 literal 0 |
| `backend/execution/SystemExecutionContract.ts` | backend execution | Work/Validation + Graph policy authority | Validation controller, approvals and permission boundary | replace | 04..06 | prompt contract tests | Graph/Job terminology 0 |
| `backend/execution/providers/**` | backend adapter | provider transport/events/structured output | same neutral transport for new schemas | keep | 04 | Codex/Copilot adapter tests | `role: job` fixtures 0 |
| `backend/execution/LocalExecutionQueue.ts` | backend execution | validate v9 outcomes and deliver terminal | validate v10 outcomes and distinguish provider failure | adapt | 04 | failure vs semantic retry tests | v9 parser 0 |
| `backend/execution/git/LocalWorkspaceManager.ts` | backend Git | root worktree snapshot, success commit/cleanup | Run worktree + refinement commit + Critic-readable artifact | adapt | 06 | path/hash/commit/cleanup tests | unsafe cleanup gap closed |
| `backend/tracker/**` | backend adapter | GraphNode-linked outbox and reconciliation | neutral Action/Run-linked outbox | adapt | 03..04 | fault/restart/duplicate matrix | graph-node column/name 0 |
| `backend/graph-node-modules/**` | backend module | module inspect/install/export/remove | no target responsibility | remove | 09 | route/service/path absence | directory/import 0 |
| `backend/services/{AutomationService,WorkspaceDataService}.ts` | backend service | Graph workspace data | target workspace data | replace | 07 | service/API tests | vNext service canonicalized 09 |
| `backend/store.ts` | backend composition | Graph/module operations | target authoring/approval/refinement operations | replace | 07 | composition tests | module methods 0 |
| `backend/http/apiRouter.ts` | HTTP | current `/api` Graph/module/run routes | isolated `/api/vnext`, then canonical target API | adapt | 07,09 | route inventory/security tests | `/api/vnext` 0 after 09 |
| `backend/server/createBalletServer.ts` | HTTP security | loopback and origin enforcement | unchanged security around new API | keep | 07 | security tests | none |
| SSE/invalidation services | backend/frontend | task console and refresh facts | target facts without provider-prose control | adapt | 07..08 | reconnect/replay tests | old DTOs 0 |
| `frontend/src/workspace/routing.ts` | frontend routing | `/automation/graph...`, Graph/GraphNode Runs | `/vnext` target, then canonical Direction/Use Case/Environment routes | replace | 08,09 | route/back-forward tests | `/vnext` and old routes 0 after 09 |
| `frontend/src/workspace/automation/**` | frontend authoring | capability cards, matrices, Action flow | target workspaces and Validation-led Action flow | replace | 08 | component/a11y/scale tests | policy/matrix components 0 |
| `frontend/src/workspace/runs/**` | frontend Run UI | policy/ledger/Q/V and Graph positions | ordered gate, Feedback, approvals, refinement, Product Snapshot | replace | 08 | factual DTO/browser tests | policy labels/fields 0 |
| `frontend/src/workspace/layout/**` | frontend shell | Graph navigation and run sidebars | Direction/Use Case/Environment/Feedback navigation | adapt | 08..09 | keyboard/narrow tests | old labels/routes 0 |
| `frontend/src/workspace/data/**`, `frontend/src/api*.ts` | frontend data | Graph/module mutations | target mutations and approval commands | adapt | 07..09 | request/refresh tests | vNext calls 0 after 09 |
| `frontend/src/components/**`, `frontend/src/styles.css` | frontend system | tokenized primitives/layout | same dark design system | keep | 08 | lint/build/visual QA | ad hoc tokens 0 |
| `.ballet/project.json` | project truth | strict v19 Graph data | strict v20 approved Use Cases + Environment | replace | 10 | validator + schema tests | Graph/policy terms 0 |
| `.ballet/graph-node-library/**` | project package data | 14 Module v7 packages | no target responsibility | remove | 10 | path and term absence | directory entries 0 |
| `.ballet/graph-node-modules/**` | project materialization | installed module provenance when present | no target responsibility | remove | 09..10 | path absence | directory entries 0 |
| `.ballet/instructions/**` | project prompt truth | role-specific free-form instructions | required target sections and Validation-led roles | adapt | 10 | instruction-section validator | old routing terms 0 |
| `.agents/skills/**` | project skills | shared Graph/arc42 workflow guidance | impacted target guidance with exact proposal hashes | adapt | 06,10 | reference/impact tests + arc42 | unapproved shared changes 0 |
| `.ballet/theme.json` | project design data | Action flow artwork/style | retained token/artwork inputs where target uses them | adapt | 08,10 | schema + visual QA | Graph-only fields 0 |
| `.fixture-ballet-project/**` | release fixture | v19/Module v7/Graph fixture | v20 Environment target fixture | replace | 10 | packaged smoke | v19/module artifacts 0 |
| `scripts/build-release.sh` | release | v19/module/SQLite v15 smoke | v20/target API/SQLite v16 smoke | replace | 10 | release build/install smoke | old assertions 0 |
| `.ballet/tools/validate-arc42.mjs` | governance | hard-coded v19 Reward-MDP defaults | target architecture/config/trace/removal validation | replace | 09..10 | deliberate negative fixtures | old expected terms 0 |
| `ARCHITECTURE.md`, `README.md`, arc42 canon | architecture | accepted active v19 truth | accepted target truth + historical pointers | supersede-doc | 09..10 | arc42 links/IDs/trace | active canonical old claims 0 |
| `AGENTS.md`, `DESIGN.md` | governance/design | protected Graph/MDP/Action flow | transition exception, then target design authority | supersede-doc | 01,09..10 | design lint/browser QA | transition exception/vNext 0 at final |
| Existing Graph/policy/module tests | tests | assert removed contracts | historical Git evidence only | remove | 09..10 | replacement test coverage map | active old assertions 0 |
| New vNext tests | tests | isolated target verification | canonical target test suite | adapt | 02..09 | phase-specific suites | vNext naming 0 after 09 |

## Strict removal gates

Phase 09 must make the following active-surface command return no matches. Historical `.ballet/arc42/initiatives/**` and superseded Goal/ADR files are intentionally outside the search set and remain audit trail.

```bash
rg -n -S \
  'reward_mdp|GraphNode|ActionNode|policy_decision|policy_observation|acceptance_ledger|graph-node-module|/automation/graph' \
  shared backend frontend .ballet/project.json .ballet/graph-node-library .ballet/graph-node-modules \
  .ballet/instructions .agents/skills .fixture-ballet-project scripts \
  ARCHITECTURE.md README.md DESIGN.md AGENTS.md
```

The exact root-kind gate is separate so formatting changes cannot hide it:

```bash
rg -n -F 'rootKind: "graph"' shared backend frontend .ballet/project.json .fixture-ballet-project scripts
rg -n -F 'rootKind: "graph_node"' shared backend frontend .ballet/project.json .fixture-ballet-project scripts
```

The filesystem gate must also pass:

```bash
test ! -e backend/graph-node-modules
test ! -e .ballet/graph-node-library
test ! -e .ballet/graph-node-modules
```

Before final acceptance, active canonical documentation must have no old control-owner claims; any historical matches must be confined to documents whose frontmatter status is `superseded` or to initiative audit/evidence history. No allowlist applies to active source, canonical config, fixtures, instructions, skills or release scripts.

## Completion rule

Compile success alone is insufficient. Every row marked `replace`, `remove` or `supersede-doc` needs its named verification; all temporary vNext routes/types/tables/tests must be canonicalized or deleted; the strict removal gates, full repository gates, 1440×900 and 390×844 browser QA, packaged install/startup smoke and clean Git status must pass.
