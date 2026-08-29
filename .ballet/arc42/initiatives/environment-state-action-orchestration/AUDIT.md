---
id: environment-state-action-orchestration-audit
title: Environment State Action orchestration baseline audit
status: draft
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags:
  - arc42
  - initiative
  - audit
  - orchestration
---

# Environment State Action orchestration baseline audit

## Audit identity

| Field | Audited value |
| --- | --- |
| Initiative ID | `environment-state-action-orchestration` |
| Baseline commit | `13d9c8d93acb56d569613aa7aa1bd5027317cce1` |
| Branch | `main` |
| Audit date | 2026-08-29 |
| Working tree at start | clean |
| Target source | Project owner's 2026-08-29 strict-cut request |

The current architecture owners are [goal-021](../../../goals/goal-021-hierarchical-reward-mdp.md), [adr-033](../../../adr/adr-033-hierarchical-node-owned-reward-mdp.md), [architecture status](../../STATUS.md) and [traceability](../../TRACEABILITY.md). This audit records facts and proposed change surfaces. It does not activate the target model or alter runtime behavior.

## Version matrix

| Contract | Active version | Exact producer and validator symbols |
| --- | ---: | --- |
| Project Config | 19 | `projectConfigurationVersion`, `ProjectConfiguration.version` in `shared/domain/automation.ts` and `shared/domain/projectConfig.ts`; `projectConfigSchema` in `shared/api/workspace-schemas.ts`; `ProjectConfigurationRepository.load` |
| Decision Model | 4 | `decisionModelVersion`, `ProjectScopedRewardDecisionModelV4`, `ProjectScopedRewardDecisionStrategyV4` in `shared/domain/decisionModelConfig.ts`; `decisionModelV4Schema` in `shared/api/decision-model-schemas.ts` |
| Graph Node Module | 7 | `graphNodeModulePackageVersion`, `GraphNodeModulePackageV7` in `shared/domain/graphNodeModules.ts`; `graphNodeModulePackageV7Schema` |
| Root Snapshot | 12 | `RootExecutionSnapshot.version` in `shared/domain/executionRuntime.ts`; `GraphExecutionPlanner.create`; `rootExecutionSnapshotSchema` in `backend/runs/RootRunStore.ts` |
| Policy decision / observation | 5 / 5 | `PolicyDecisionRecordV5`, `PolicyOptionObservationV5`; `policyDecisionRecordSchema`, `policyOptionObservationSchema`; `RootExecutionSnapshot.policyObservationContractVersion` |
| Task Envelope / role outcome | 9 / 9 | `taskEnvelopeVersion`, `TaskEnvelopeV9`; `taskEnvelopeV9Schema`; `NODE_OUTCOME_SCHEMA_VERSION`, `workNodeOutcomeSchema`, `validationNodeOutcomeSchema` |
| Prompt composition | 10 | `EXECUTION_COMPOSITION_VERSION`; `ExecutionPromptEvidence.compositionVersion`; `composeExecutionPrompt` |
| ExecutionSpec | 11 | `ExecutionSpec.version`; `executionSpecSchema`; producer in `LocalRunService.enqueuePending` |
| SQLite | 15 | `localDatabaseSchemaVersion`; `runtimeSchema`; fail-closed check in `LocalDatabase.openSchema` |

The baseline is exactly the v19/v4/v7/v12/v5/v9/v10/v11/v15 matrix described by [ARCHITECTURE.md](../../../../ARCHITECTURE.md). The proposed strict next matrix is recorded below; no version is changed by this audit.

## Current domain

| Concept | Current source and responsibility | Target implication |
| --- | --- | --- |
| Graph | `ProjectGraph` in `shared/domain/automation.ts` owns State initial value, acceptance ledger, global Reward-MDP and GraphNodes. | Replace with one Environment that owns ordered States. |
| GraphNode | `ProjectGraphNode` owns capabilities, typed outcomes, state contract, local Reward-MDP and ActionNodes. | Remove; State becomes the ordered project unit, not a policy scope or standalone Run target. |
| ActionNode | `ProjectActionNode` aggregates `workNode`, `validationNode`, intrinsic outcomes and `maxRetries`. | Replace with Action; invert execution ownership so Validation is controller and Work subordinate. |
| Work / Validation | `ProjectWorkNode` executes first; `ProjectValidationNode` evaluates after Work with `PASS | FAIL` and `retry | escalate`. | Preserve provider/human execution primitives but introduce Validation precheck and restricted `done | delegate | blocked` / `done | retry | blocked` outputs. |
| Policy / acceptance | Decision Model v4, compiled policies, policy decision/observation v5 and acceptance ledger select and gate nodes. | Remove from active code/config/persistence/UI; ordered status and human approvals become control truth. |
| RootRun | `RootRunKind = "graph" | "graph_node"`; `RootExecutionSnapshot.rootKind` and `StartRootRunRequest.kind` expose Graph and GraphNode roots. | Replace with Environment Run plus immutable continuation-run semantics; no State or Action standalone Runs. |

## Current control flow

The symbol-backed path is:

1. **Start:** `POST /api/runs` validates `startRunBodySchema` and calls `LocalRunService.start`.
2. **Planner/worktree:** `LocalWorkspaceManager.prepare` creates `ballet/run/<rootRunId>` and `GraphExecutionPlanner.create` loads strict v19, snapshots resources and compiles global/local policies.
3. **Persistence:** one transaction calls `RootRunStore.create` and `RuntimeDatabase.initializeRoot`; `RuntimeFlowCoordinator.initialize` seeds State/ledger and dispatches the first policy choice.
4. **Provider dispatch:** `LocalRunService.enqueuePending` builds Task Envelope v9 and composition v10, persists ExecutionSpec v11 through `ExecutionStore.create`, then wakes `LocalExecutionQueue`.
5. **Provider outcome:** `CodexAppServerAdapter` or `CopilotSdkAdapter` returns structured output; `LocalExecutionQueue` validates it with `parseNodeOutcomeForRole`.
6. **Coordinator:** `LocalRunService.handleTerminal` calls `RuntimeDatabase.applyNodeOutcome`; `RuntimeFlowCoordinator.afterWork` always creates Validation after completed Work, and `afterValidation` performs bounded retry, acceptance application and policy continuation/terminal handling.
7. **Finalization:** terminal state returns through `LocalRunService.advance` to `finalizeRoot`; `LocalWorkspaceManager.finalize` commits only successful work and retains failures, while `cleanupSuccessful` immediately removes a successful worktree.

There is no Validation precheck before Work, schedule dispatcher, Critic, Feedback Box, refinement proposal/apply command, human approval state machine or continuation-run root in the active path.

## Project truth and machine-local truth

| Truth owner | Active content | Cutover treatment |
| --- | --- | --- |
| Git project truth | `.ballet/project.json`, `.ballet/graph-node-library/**`, `.ballet/instructions/**`, `.agents/skills/**`, `.ballet/arc42/**`, `.ballet/goals/**`, `.ballet/adr/**`, `.ballet/releases/**`, `.tickets/**`, `DESIGN.md` | Strictly replace project config/module data and supersede canonical docs; retain historical decisions and initiative audit trail. |
| Machine-local runtime truth | `.git/ballet/state.sqlite`, `.git/ballet/worktrees/**`, `.git/ballet/settings.json`, `.git/ballet/service.json`, `.git/ballet/logs/**` | Replace SQLite v15 with a fresh strict v16 database; do not migrate or read v15. Preserve checkout-local settings/service/log principles. |
| Immutable Run truth | `RootExecutionSnapshot`, State revisions, policy/ledger facts, execution tasks/events and finalization report | Adapt snapshot/resource/execution evidence; replace policy/ledger/invocation facts with ordered State/Action, Feedback, approvals, Critic and refinement facts. |

## Impact inventory

### Shared contracts

- `shared/domain/automation.ts`: remove `ProjectGraph`, `ProjectGraphNode`, `ProjectActionNode`, Reward-MDP and acceptance shapes; add Environment/State/Action configuration and Validation-led execution contracts.
- `shared/domain/decisionModel*.ts`: remove active Decision Model, compiled policy, policy decision/observation and ledger contracts.
- `shared/domain/graphNodeModules.ts`: remove Graph Node Module v7 package surface; no renamed compatibility package.
- `shared/domain/projectConfig.ts`: replace strict v19 shape with v20.
- `shared/domain/runtime.ts`, `runtimeOrchestration.ts`, `runs.ts`, `executionRuntime.ts`, `taskEnvelope.ts`: replace Graph/GraphNode/ActionNode identities, statuses and root kinds; bump snapshot/envelope/outcome/composition/spec contracts.
- `shared/api/{workspace,project-config,decision-model,graph-node-module,runtime,task-envelope}-*.ts`: replace active schemas and DTO boundaries; delete policy/module endpoints and aliases.

### Backend

- Loaders/writers: `backend/project-config/**`, `backend/automation/**`, `backend/services/AutomationService.ts`, `backend/store.ts`.
- Planner/run services: `backend/runs/GraphExecutionPlanner.ts`, `LocalRunTargetService.ts`, `LocalRunService.ts`, `RootRunStore.ts`, `RunReadProjection.ts`.
- Runtime: `backend/runtime/RuntimeDecisionDispatcher.ts`, `RuntimeFlowCoordinator.ts`, `RuntimeFlowSupport.ts`, `RuntimeInvocationStore.ts`, `RuntimePolicyStore.ts`, `RuntimePolicyTransition.ts`, `RuntimeTaskEnvelopeBuilder.ts`, `RuntimeEventStore.ts`, `RuntimeStateStore.ts`, `backend/runtime-db.ts`.
- Policy: remove active `backend/policy/**` Reward-MDP compiler/projection/authorization surfaces; retain reusable canonical hashing only if moved to a neutral owner.
- Persistence: replace `backend/storage/RuntimeSchema.ts` and v15 mapper/store assumptions; `LocalDatabase.openSchema` remains fail-closed.
- Execution: adapt `ExecutionComposition.ts`, `ExecutionSpecSchema.ts`, `SystemExecutionContract.ts`, `ExecutionStore*`, `LocalExecutionQueue.ts`; provider adapters and structured-output parsing remain reusable.
- Worktrees: adapt `backend/execution/git/LocalWorkspaceManager.ts` for refinement commits, immutable continuation and Critic read lifetime.
- HTTP/security/events: adapt `backend/http/apiRouter.ts`, validation and error mapping; keep `createBalletServer.loopbackSecurity`, SSE framing and invalidation broadcaster.
- Tracker: decouple `backend/tracker/**` from GraphNode invocation IDs while preserving argv-only, outbox and reconciliation.
- Modules: remove `backend/graph-node-modules/**` and the corresponding service/store routes at strict cut.

### Frontend

- Replace `/automation/graph`, `/automation/graph/nodes/:graphNodeId`, Action Node and Graph/GraphNode Run routes in `frontend/src/workspace/routing.ts` and `balletModeNavigation.ts`.
- Replace `frontend/src/workspace/automation/**` graph/matrix/Action-flow projection with Direction, Use Cases, ordered Environment/State/Action authoring and run gates.
- Adapt `frontend/src/workspace/runs/**` from policy/ledger facts to State/Action status, Feedback, approvals, Critic, refinement and Product Snapshot facts.
- Adapt `WorkspaceRouteOutlet.tsx`, sidebar menus, workspace types, API client/mutations and active-run authoring locks.
- Preserve shared shadcn primitives, hooks, tokenized workbench layout and responsive/a11y conventions.

### Project data, docs, tests and release

- Replace `.ballet/project.json` with strict v20 and remove `.ballet/graph-node-library/**` plus any materialized `.ballet/graph-node-modules/**` surface.
- Update `.ballet/instructions/**` to the target required-section contract. The current 17 instructions do not use explicit `Purpose / Inputs / Outputs / Guardrails` headings.
- Review all seven shared project Skill IDs used by current default actions: `architecture-views`, `conformance-review`, `decision-records`, `document-maintenance`, `evaluation`, `quality-scenarios`, `traceability`. Shared skill changes must be exact-path/hash-scoped because multiple Actions consume them.
- Supersede active Graph/Reward-MDP claims in `ARCHITECTURE.md`, `README.md`, `DESIGN.md`, root/nested `AGENTS.md`, arc42 sections, status, traceability, goals and ADR index only at the planned cutover point.
- Replace `.fixture-ballet-project/**`, `.ballet/tests/projectLocalGraphNodeLibrary.test.ts` and the Graph Node Module checks in `scripts/build-release.sh`.
- Update `Makefile`/install smoke expectations only where the strict schema and startup output change.

## Reusable surfaces

| Surface | Why it can be adapted |
| --- | --- |
| Provider adapters | `CliRuntimeAdapter`, Codex and Copilot adapters already transport prompt + strict output schema without owning Graph policy. |
| ExecutionProfiles | Provider/model/reasoning/network selection is domain-neutral. |
| Worktrees | Snapshot isolation, path checks, Git argv execution and commit evidence are reusable; lifecycle needs refinement/Critic changes. |
| Resource composition | System/primary/skill ordering, hashes, byte limits and explicit selection remain valid after contract bumps. |
| Queue/events | Durable ExecutionTask queue, normalized provider events and restart interruption semantics are domain-neutral. |
| SQLite wrapper | WAL/FULL/foreign-key setup and strict fail-closed version check are reusable with a replacement schema. |
| HTTP security | Loopback host and same-origin mutation checks are independent of orchestration vocabulary. |
| SSE | Execution console and workspace invalidation streams carry factual events and can use new DTOs. |
| Design tokens | Existing dark palette, Inter/Geist, spacing, radii and responsive primitives remain authoritative. |
| Tracker adapter/outbox | Idempotent argv-only external process boundary is reusable once invocation identity is neutralized. |

## Strict-cut removals

Remove rather than alias or wrap:

- `reward_mdp_v4`, Decision Model v4, compiler/Q/V, policy preview, policy decisions/observations and acceptance ledger.
- `Graph`, `GraphNode`, `ActionNode` domain types, IDs, invocations, routes, UI names and Root Run kinds.
- Graph Node Module v7 types, packages, catalog, install/export/remove operations and release smoke.
- `/automation/graph` and Graph/GraphNode run routes; no route aliases.
- SQLite tables `graph_node_invocations`, `action_node_invocations`, `policy_decisions`, `policy_observations`, `acceptance_ledger_entries` and their foreign keys/event vocabulary.
- Config fields `graph`, `strategy`, `acceptance`, `graphNodes`, `actionNodes`, node outcomes/capability routing used only by the old control owner.
- Protected reward/policy matrix and free Graph topology projections after atomic UI canonicalization.
- Strict-v19 readers and v15 DB readers. The v16 opener must reject v15 unchanged with archive/remove remediation.

## Protected contracts requiring supersession

- Root `AGENTS.md` protects the three-level Graph Node Engineering canvases, 24 px grid, planet artwork, 5×5/N×N Decision Models, Action Node flow, Graph/GraphNode root semantics, module v7 boundary and the statement that schedules are absent.
- `DESIGN.md` makes `/automation/graph...` the three canonical authoring levels and protects Reward-MDP matrices, acceptance rail, Action flow, module UI and Graph/GraphNode Run projections.
- `adr-025` and `adr-027` protect the industrial Action Node visual flow; `adr-029` protects capability-first authoring; `adr-031`/`adr-032` retain surviving reward/UI parts; `adr-033` is the active Graph/GraphNode policy owner.
- `goal-021`, `ARCHITECTURE.md`, arc42 sections, `STATUS.md`, `STATE-CONTRACT.md`, `TRACEABILITY.md` and `README.md` all name the strict-v19 baseline.

The target ADR must supersede the control/domain and matrix/flow parts explicitly while preserving the existing palette, typography, density, accessibility, worktree isolation, immutable evidence and external-write authorization principles.

## Risks

| Risk | Baseline finding | Required control |
| --- | --- | --- |
| Buildability between phases | Current contracts are cross-imported across shared/backend/frontend and the validator hard-codes v19. | Isolated vNext namespace plus `/api/vnext` and `/vnext`; no cross-read/write; canonicalize atomically in phase 09. |
| Runtime DB strict replacement | v15 tables and foreign keys encode policy/GraphNode/ActionNode identity. | Fresh v16 only; fail closed without migration and test that v15 bytes remain unchanged. |
| Immutable snapshot | Current snapshot compiles policy and ledger once; target needs approvals, refinement preimages and continuation provenance. | Snapshot v13 hashes all target inputs and continuation parent; never mutate an existing Run snapshot. |
| Tracker coupling | Tracker link/outbox rows name `graph_node_invocation_id`. | Replace with neutral run/action provenance without losing unique external-ref or reconcile-before-progress. |
| Schedule lifecycle | No active schedule domain or table exists despite historical ADR text. | Design Critic schedule, lease/idempotency/restart/cancel rules and human controls as new v1 behavior. |
| Human approval integrity | Current human boundary handles Work/Validation responses, not proposal approvals. | Separate typed approval commands, optimistic revision/preimage checks and append-only audit facts. |
| Refinement patch safety | Existing `StatePatch` edits runtime JSON, not repository files. | Read-only proposal, allowed path set, exact preimage hashes, exact diff, approval command and managed-worktree apply. |
| Shared Skill impact | Seven project skills are reused by multiple default Actions. | Compute reverse-use impact; require every affected path/hash in proposal and continuation snapshot. |
| Active Run authoring lock | Current UI derives lock from active Graph/GraphNode Runs and protects graph authoring. | Lock every Environment/State/Action/Use Case/refinement source implicated by an active immutable snapshot. |
| Successful worktree cleanup vs Critic read access | `cleanupSuccessful` removes a successful worktree immediately. | Persist a readable immutable artifact/commit or retain a bounded Critic workspace until Critic capture completes. |
| Retry meaning | Current formula already uses `node.attempt <= action.maxRetries`, but Validation occurs only post-Work. | Preserve `1 + maxRetries` total Work attempts while adding precheck and atomic blocked+Feedback exhaustion. |
| Provider failure vs semantic retry | `failNode` terminalizes provider failure; semantic retry comes only from Validation FAIL. | Keep the distinction explicit in contract, events and tests. |

## Proposed exact version increment

Because every orchestration identity and all strict producer/consumer shapes change, reserve:

| Contract | Baseline | Target |
| --- | ---: | ---: |
| Project Config | 19 | 20 |
| Decision Model | 4 | removed |
| Graph Node Module | 7 | removed |
| Root Snapshot | 12 | 13 |
| Policy decision / observation | 5 / 5 | removed |
| Task Envelope / role outcome | 9 / 9 | 10 / 10 |
| Prompt composition | 10 | 11 |
| ExecutionSpec | 11 | 12 |
| SQLite | 15 | 16 |
| Feedback / Critic / Refinement | absent | v1 / v1 / v1 |

## Drift from the requested target assumptions

1. No previous environment-state-action preflight audit or initiative exists in current history; this is the first baseline artifact.
2. The current checked-out branch is `main`, not a separately named feature branch, though the working tree was clean and the user explicitly authorized local commits.
3. Schedule support is historical only; active v19 deliberately has no schedule schema, runtime or UI.
4. There are only Graph and GraphNode Root Runs; no standalone ActionNode Run exists. The target can therefore replace two roots rather than remove a third active root.
5. `maxRetries` already means additional Work attempts after the first, and current tests cover the bound; ownership still differs because Validation has no precheck.
6. Current Work outcomes may patch project State before Validation. The target's Validation-led gate must decide whether and when subordinate Work effects become authoritative.
7. Current successful finalization already creates a commit but immediately removes its worktree. Continuation can reuse commit provenance, while Critic requires a new readable artifact/lifetime rule.
8. Current provider failures bypass semantic retry and fail the Root Run; this matches the requested distinction but needs explicit target wording.
9. Current system execution instruction still says “ordered Job execution”, and Codex/Copilot adapter tests contain `role: "job"` fixtures even though the active domain contract is Work/Validation. These are baseline cleanup findings.
10. Current instructions are valid free-form Markdown; there is no machine-enforced required-section contract.
11. Current shared Skill selection has multi-consumer impact that is not represented as a refinement proposal graph.
12. The prompt references 13 Use Cases without enumerating IDs. The target contract must define a stable UC-01..UC-13 catalog from the supplied semantics before implementation traceability is claimed.

## Tests that currently prove contracts scheduled for removal

| Test surface | Removable contract currently asserted |
| --- | --- |
| `backend/policy/RewardMdpCompiler.test.ts` | v4 solver, Q/V, absorption, sparse node-ID policy. |
| `backend/policy/RewardAuthorization.test.ts` | policy admissibility and hard authorization. |
| `backend/runtime/RuntimeFlowCoordinator.test.ts` | global→local→Action→local→global, retry/escalate, acceptance mismatch, root kinds. |
| `backend/storage/LocalDatabase.test.ts` | SQLite v15 and policy/ledger/GraphNode/ActionNode tables. |
| `.ballet/tests/projectLocalGraphNodeLibrary.test.ts` | 14 Graph Node Module v7 packages and roundtrip. |
| `frontend/tests/decisionModelWorkspace.test.tsx` | 5×5/N×N Reward Decision Model and virtualization. |
| `frontend/tests/graphNodeAuthoring.test.ts` | GraphNode/ActionNode CRUD and Reward-MDP reference rewrites. |
| `frontend/tests/actionFlowCanvas.test.tsx`, `actionFlowProjection.test.ts`, `automationViewActionFlow.test.tsx` | protected Action Node Work→Validation canvas. |
| `frontend/tests/runPolicyViews.test.tsx` | policy/ledger/Q/V Run projection. |
| `frontend/tests/routing.test.ts`, `workspaceNavigation.test.tsx`, `balletModeUi.test.tsx` | `/automation/graph` and Graph/GraphNode Run route contracts. |
| `scripts/build-release.sh` | strict-v19 fixture, Module v7 API/catalog and SQLite v15 startup. |

These tests must be replaced by target-behavior tests, not merely deleted. Phase 09 removal gates are defined in [CUTOVER-MANIFEST.md](CUTOVER-MANIFEST.md).

## Audit conclusion

The target is a semantic cut, not a rename. Provider, execution, isolation, persistence-wrapper, security, SSE and design-token infrastructure are viable adaptation seams. Policy/ledger/Graph/GraphNode/ActionNode/module contracts are inseparable from the active control owner and require coordinated replacement. Implementation remains unauthorized until the accepted Goal/ADR/Target Contract in the next architecture phase.
