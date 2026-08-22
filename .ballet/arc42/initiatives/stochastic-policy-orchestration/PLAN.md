---
id: stochastic-policy-orchestration-plan
title: Stochastic Policy Orchestration PLAN
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - plan
  - ssp
---

# Stochastic Policy Orchestration PLAN

## Toteutusta edeltävä ihmisportti

`goal-016`, `adr-026`, `QS-021`-prioriteetti/mitta ja SPO-OQ-001–004 ratkaistaan ennen yhtäkään implementation-stepiä. Suositeltu strict cut on project config v15, Root Snapshot v8 ja SQLite v11. Graph Node Module v4, Task Envelope/outcome v7, composition v8 ja ExecutionSpec v9 pysyvät ensimmäisessä sliceissä ennallaan, koska Decision State käyttää vain deterministic canonical feature sourceja eikä lisää provider-tehtävää.

## Proposed domain contract

```ts
type ProjectGraphDecisionStrategyV1 =
  | { kind: "agent_v1"; orchestrator: ProjectAgentOrchestrator }
  | { kind: "ssp_v1"; model: ProjectSspDecisionModelV1 };

interface ProjectSspDecisionModelV1 {
  version: 1;
  features: DecisionFeatureDefinitionV1[];
  states: DecisionStateDefinitionV1[];
  stateActions: OptionModelRowV1[];
  solver: SspValueIterationConfigV1;
  projection: PolicyProjectionLimitsV1;
}

interface DecisionStateV1 {
  stateId: string;
  features: Record<string, string>;
  featureVectorSha256: string;
  sourceStateRevision: number;
  evidenceRefs: string[];
}

interface OptionModelRowV1 {
  stateId: string;
  graphNodeId: string;
  expectedCostMicros: number;
  successors: Array<{ nextStateId: string; probabilityPpm: number }>;
}

interface PolicyDecisionV1 {
  epoch: number;
  state: DecisionStateV1;
  admissibleActionIds: string[];
  excludedActions: Array<{ graphNodeId: string; reasonCode: string }>;
  selectedGraphNodeId: string;
  actionValues: Array<{ graphNodeId: string; qMicros: number }>;
  stateValueMicros: number;
  tiedActionIds: string[];
  solver: { algorithm: "ssp_value_iteration_v1"; iterations: number; residual: number; epsilon: number };
  modelSha256: string;
  policySha256: string;
  snapshotSha256: string;
}
```

V1 feature source -union sisältää vain named canonical runtime factin, bounded State JSON Pointer + enum domainin tai authorization fact + enum domainin. LLM classifier -observation on myöhempi extension eikä kuulu ensimmäiseen sliceen.

## Toteutusjärjestys

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPO-step-000 | goal-016 / REQ-016 | QS-021 | adr-026 / CON-012 | BB-008 | — | Goal/ADR/BRIEF human review | explicit human decision for SPO-OQ-001–004 | SPO-EVID-000 |
| SPO-step-001 | goal-002, goal-016 / REQ-002, REQ-016 | QS-002, QS-021 | adr-026 / CON-004 / CON-012 | BB-003 / BB-011 | DEP-001 | `shared/domain/decisionModel.ts`, strict v15 schemas, project repository normalization | generic schema/property fixtures, stale-reference rejection | SPO-EVID-001 |
| SPO-step-002 | goal-006, goal-016 / REQ-006, REQ-016 | QS-012, QS-021 | adr-026 / CON-002 / CON-012 | BB-005 / BB-011 | RT-016 | `DecisionStateProjector`, `AdmissibleActionResolver` | exhaustive feature-domain, missing/unknown, permission/authorization tests | SPO-EVID-002 |
| SPO-step-003 | goal-016 / REQ-016 | QS-021 | adr-026 / CON-012 | BB-011 | RT-016 | pure `SspPolicySolver`, canonical hash, MEC/proper-policy analysis | Bellman fixtures, invalid sums, unreachable goal, tie, convergence/time/size bounds | SPO-EVID-003 |
| SPO-step-004 | goal-006, goal-016 / REQ-006, REQ-016 | QS-012, QS-021 | adr-026 / CON-002 / CON-012 | BB-004 / BB-005 / BB-011 | RT-009 / RT-016 / DEP-002 | Snapshot v8, Graph runtime strategy port, SQLite v11 decision/observation rows | atomic dispatch, restart/cancel/no-duplicate, no-fallback, DB10 fail-closed | SPO-EVID-004 |
| SPO-step-005 | goal-007, goal-016 / REQ-007, REQ-016 | QS-013, QS-020, QS-021 | adr-026 / CON-005 / CON-012 | BB-001 / BB-002 / BB-011 | RT-010 / RT-016 / DEP-001 | Configure Decision Model editor/preview; Run state/A/Q/projection/execution read models | source-of-truth, a11y, 1/5/40, desktop/narrow, projection-bound tests | SPO-EVID-005 |
| SPO-step-006 | goal-002, goal-006, goal-016 / REQ-002, REQ-006, REQ-016 | QS-002, QS-012, QS-021 | adr-026 / CON-006 / CON-012 | BB-008 / BB-011 | RT-016 | docs, fixtures, platform boundary, release notes | full gates, arbitrary-node name audit, conformance review | EVID-021 / SPO-EVID-006 |

## Solver acceptance matrix

| Tapaus | Odotettu tulos |
| --- | --- |
| Valid proper deterministic model | Exact optimal action, finite Q/V, residual ≤ epsilon. |
| Valid stochastic model | Probability-weighted Q/V and proper bottom-SCC verdict. |
| Probability sum ≠ 1 000 000 tai duplicate successor | Preflight error, 0 decisions, 0 dispatches. |
| Missing state/action row tai empty nonterminal `A(s)` | Model invalid, explicit `needs_input`/error mapping, 0 fallbackia. |
| Unreachable success, reachable failure/blocked under every policy tai closed non-goal MEC | `policy_no_proper_policy`, 0 dispatches. |
| Iteration/time/size bound exceeded tai non-finite arithmetic | `policy_not_converged`/`policy_model_invalid`, 0 dispatches. |
| Q-tie epsilonin sisällä | Persist all tied IDs; lexicographically smallest stable GraphNode ID wins. |
| Unauthorized/out-of-snapshot action | Excluded reason persisted; action absent from Q-list and selected action. |
| Sama snapshot/state kahdesti | Same model/policy hash, selected action, ordered Q-values, iterations and residual. |

## Arbitrary GraphNode fixture

Primary fixture käyttää `discover`, `prototype`, `security-check`, `package`, `publish`. Metamorphic variant nimeää ne `survey`, `experiment`, `assure`, `bundle`, `ship` ja päivittää vain project-data-viitteet. Solver-, snapshot-, persistence- ja UI-assertiot ovat samat stable ID -arvoja lukuun ottamatta. Platform-source-haku kieltää kummankin fixturen ID:t `backend/`, `frontend/src/` ja `shared/`-tuotantokoodissa.

## Migration ja legacy removal

Hyväksyttynä muutos on pre-production strict cut. V14-config ja DB10-kanta jäävät koskemattomiksi ja startup antaa archive/remediation-ohjeen; readeria, aliasia tai dual-writeä ei lisätä. Existing `routing_requests/decisions` joko generalisoidaan uudelle decision epoch -sopimukselle tai korvataan v11:ssä; rinnakkaista canonical decision storea ei jätetä. `agent_v1` on intentional strategy, ei legacy fallback.

## Portit

`npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build`, Graph Node Module v4 regression smoke, `git diff --check`, project-workflow platform-boundary -haku, arbitrary fixture ID -haku, `make latest` ja `ballet --no-open` startup/status smoke. UI-muutoksessa luetaan `DESIGN.md`; protected canvas -muutos vaatii erillisen ADR/visual QA:n.

## Non-goals ja pysähtymisehto

Automatic learning, multi-cost, classifier LLM, GraphNode-scope policy, release/deploy/merge/push ja active snapshot model mutation eivät kuulu sliceen. Implementation pysähtyy `needs_input`-tilaan, jos SPO-OQ-001–004 tai priority-1-mitta jää hyväksymättä.
