---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 28
tags:
  - arc42
  - traceability
  - evidence
---

# Balletin arkkitehtuurin jäljitettävyys

## Tarkoitus

Tämä tiedosto yhdistää hyväksytyn, review- tai draft-tilaisen intentin mitattavaan evidenssiin kopioimatta stable ID:iden omistamaa kanonista sisältöä. Jokaisella `goal-001`–`goal-022` / `REQ-001`–`REQ-022` -parilla on vähintään yksi havaittava QS–ratkaisu–testi–evidenssi-ketju.

## Tila

Matriisi sisältää 32 laatuketjua. QS-027 on aktiivisen v19-cutin trace phase-09 cutoveriin asti. QS-028–QS-032 ovat `goal-022` / `adr-034` -targetin hyväksyttyjä mutta implementation-evidenssiltään pending-ketjuja; dokumenttivalidointi ei muuta niiden statusta verifiediksi.

## Trace-matriisi

<!-- traceability:start -->
| Goal/Requirement | Quality Scenario | ADR/Concept | Building Block | Runtime/Deployment Scenario | Test/Monitor | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| goal-001 / REQ-001 | QS-001 | adr-001 / CON-001 | BB-001 / BB-002 | RT-001 / DEP-001 | TEST-001 | EVID-001 | verified |
| goal-002 / REQ-002 | QS-002 | adr-002 / CON-004 | BB-003 / BB-008 | RT-001 / DEP-001 | TEST-002 | EVID-002 | verified |
| goal-003 / REQ-003 | QS-011 | adr-005 / adr-012 / adr-013 / CON-003 | BB-003 / BB-004 / BB-006 | RT-008 / DEP-002 | TEST-011 | EVID-011 | verified |
| goal-004 / REQ-004 | QS-003 | adr-015 / CON-002 | BB-004 / BB-005 | RT-003 / DEP-002 | TEST-003 | EVID-003 | verified |
| goal-005 / REQ-005 | QS-004 | adr-006 / CON-001 | BB-004 / BB-007 | RT-001 / DEP-002 | TEST-004 | EVID-004 | verified |
| goal-006 / REQ-006 | QS-012 | adr-007 / adr-015 / CON-002 | BB-004 / BB-005 / BB-006 | RT-009 / DEP-001 / DEP-002 | TEST-012 | EVID-012 | verified |
| goal-007 / REQ-007 | QS-013 | adr-015 / adr-017 / CON-005 | BB-001 / BB-002 / BB-005 | RT-010 / DEP-001 | TEST-013 | EVID-013 | verified |
| goal-008 / REQ-008 | QS-007 | adr-009 / CON-001 | BB-007 | RT-005 / DEP-003 | TEST-007 | EVID-007 | policy verified; execution pending |
| goal-009 / REQ-009 | QS-005 | adr-011 / CON-006 | BB-003 / BB-008 | RT-004 / DEP-001 | TEST-005 | EVID-005 | verified |
| goal-009 / REQ-009 | QS-006 | adr-011 / CON-006 | BB-004 / BB-008 | RT-003 / DEP-002 | TEST-006 | EVID-006 | pending pilot |
| goal-009 / REQ-009 | QS-008 | adr-011 / CON-006 | BB-003 / BB-008 | RT-004 / DEP-001 | TEST-008 | EVID-008 | pending pilot |
| goal-010 / REQ-010 | QS-009 | adr-016 / adr-019 / CON-007 | BB-001 / BB-002 / BB-003 / BB-009 | RT-006 / RT-007 / DEP-001 | TEST-009 | EVID-009 | implementation and Phase 6 package evidence verified; full gate pending |
| goal-011 / REQ-011 | QS-010 | adr-017 / CON-005 | BB-001 / BB-009 | RT-006 / DEP-001 | TEST-010 | EVID-010 | verified |
| goal-012 / REQ-012 | QS-014 | adr-018 / adr-019 / CON-002 / CON-005 | BB-001 / BB-003 / BB-004 / BB-005 / BB-006 / BB-009 | RT-011 / DEP-001 / DEP-002 | TEST-014 | EVID-014 | technical implementation including Graph control and one-responsibility Loop library passed; human acceptance pending |
| goal-013 / REQ-013 | QS-015 | adr-020 / adr-021 / CON-002 / CON-005 / CON-008 | BB-001 / BB-003 / BB-004 / BB-005 / BB-006 / BB-009 | RT-002 / RT-003 / RT-009 / RT-011 / DEP-001 / DEP-002 | TEST-015 | EVID-015 | technical implementation, ADR-021 canvas correction and final gates passed; human visual acceptance pending |
| goal-014 / REQ-014 | QS-016 | adr-022 / CON-009 | BB-003 / BB-004 / BB-005 / BB-006 / BB-009 | RT-012 / DEP-002 | TEST-016 | EVID-016 | verified locally |
| goal-014 / REQ-014 | QS-017 | adr-021 / adr-022 / CON-005 / CON-009 | BB-001 / BB-002 / BB-009 | RT-010 / RT-012 / DEP-001 | TEST-017 | EVID-017 | technical/browser verified; human visual acceptance pending |
| goal-014 / REQ-014 | QS-018 | adr-022 / CON-010 | BB-004 / BB-005 / BB-010 | RT-013 / DEP-002 / DEP-004 | TEST-018 | EVID-018 | hermetic verified; pinned live smoke pending |
| goal-015 / REQ-015 | QS-019 | adr-023 / CON-002 / CON-003 / CON-011 | BB-003–BB-006 / BB-009 / BB-010 | RT-014 / RT-015 / DEP-002 | TEST-019 | EVID-019 | technical/conformance passed; live provider pilot open |
| goal-015 / REQ-015 | QS-020 | adr-023 / adr-025 / adr-027 / CON-005 / CON-011 | BB-001 / BB-002 / BB-009 | RT-014 / DEP-001 | TEST-020 | EVID-020 | ADR-025/027 automated/browser/installed-app evidence passed; human visual verdict pending |
| goal-002 / REQ-002; goal-006 / REQ-006; goal-007 / REQ-007; goal-016 / REQ-016 | QS-021 | adr-026 / CON-012 | BB-003–BB-005 / BB-011 | RT-009 / RT-010 / RT-016 / DEP-001 / DEP-002 | TEST-021 | EVID-021 | accepted generic core passed; full projection, max-bound benchmark, cancel-race stress and pilot pending |
| goal-016 / REQ-016; goal-017 / REQ-017 | QS-022 | adr-028 / CON-012 | BB-003–BB-005 / BB-011 | RT-017 / DEP-001 / DEP-002 | TEST-022 | EVID-022 | automated scoped compiler/runtime passed locally; calibrated pilot and acceptance pending |
| goal-006 / REQ-006; goal-007 / REQ-007; goal-017 / REQ-017 | QS-023 | adr-028 / CON-002 / CON-012 | BB-001 / BB-005 / BB-011 | RT-009 / RT-010 / RT-017 / DEP-001 | TEST-023 | EVID-023 | automated projector/model-miss evidence passed locally; empirical pilot pending |
| goal-007 / REQ-007; goal-018 / REQ-018 | QS-024 | adr-029 / adr-032 / CON-005 | BB-001 / BB-002 | RT-010 / RT-018 / DEP-001 | TEST-024 | EVID-024, EVID-026 | automated card/route/CRUD and visual dashboard desktop/narrow QA passed; final human pixel verdict pending |
| goal-002 / REQ-002; goal-006 / REQ-006; goal-019 / REQ-019 | QS-025 | adr-030 / CON-002 / CON-012 | BB-002–BB-005 / BB-011 / BB-012 | RT-009 / RT-019 / DEP-001 / DEP-002 | TEST-025 | EVID-025 | governance and Phase 2 observation verified; Phases 3–7 and human activation pending |
| goal-020 / REQ-020 | QS-026 | adr-031 / adr-032 / CON-002 / CON-013 | BB-001–BB-006 / BB-009 / BB-013 | RT-009 / RT-020 / DEP-001 / DEP-002 | TEST-026 | EVID-026 | technical and visual gates passed; production-like pilot pending |
| goal-021 / REQ-021 | QS-027 | adr-033 / CON-002 / CON-014 | BB-001–BB-006 / BB-009 / BB-014 | RT-022 / RT-023 / RT-024 / RT-025 / DEP-001 / DEP-002 | TEST-027 | EVID-027 | implementation and automated tests passed; final repository/browser gates pending |
| goal-022 / REQ-022 | QS-028 | adr-034 / CON-002 / CON-015 | BB-003–BB-006 / BB-015 | RT-026 / DEP-001 / DEP-002 / DEP-005 | TEST-028 | EVID-028 | accepted target; ordering/Validation implementation evidence pending |
| goal-022 / REQ-022 | QS-029 | adr-034 / CON-001 / CON-015 | BB-002 / BB-005 / BB-007 / BB-015 | RT-026 / RT-027 / DEP-001 / DEP-005 | TEST-029 | EVID-029 | accepted target; Feedback/Critic/approval evidence pending |
| goal-022 / REQ-022 | QS-030 | adr-034 / CON-015 | BB-003–BB-007 / BB-015 | RT-028 / DEP-002 / DEP-005 | TEST-030 | EVID-030 | accepted target; refinement and continuation evidence pending |
| goal-022 / REQ-022 | QS-031 | adr-034 / CON-005 / CON-015 | BB-001 / BB-002 / BB-015 | RT-026–RT-028 / DEP-001 / DEP-005 | TEST-031 | EVID-031 | accepted target; responsive accessible UI evidence pending |
| goal-022 / REQ-022 | QS-032 | adr-034 / CON-015 | BB-001–BB-008 / BB-010 / BB-015 | RT-026–RT-028 / DEP-001–DEP-005 | TEST-032 | EVID-032 | accepted target; strict cutover and release evidence pending |
<!-- traceability:end -->

## Testi- ja monitorikatalogi

| ID | Tarkistus | Omistaja |
| --- | --- | --- |
| TEST-001 | Local server-, API security- ja checkout lifecycle -testit. | platform test suite |
| TEST-002 | Strict project configuration- ja resource catalog -testit. | project configuration tests |
| TEST-003 | Workflow-, State patch-, repair allowlist- ja continuation-testit. | runtime test suite |
| TEST-004 | Git workspace- ja permission-policy-testit. | execution test suite |
| TEST-005 | `npm run validate:arc42`: rakenne, linkit, stable ID:t, trace ja project resources. | project-local validator |
| TEST-006 | Ensimmäisen initiativen trace completeness ja handoff review. | arc42 evaluate Loop |
| TEST-007 | Release authorization gate ja release-validation-evidenssi. | release-validation Loop |
| TEST-008 | METHOD-HEALTH-vertailu ensimmäisen pilotin baselineen. | continuous learning / evaluate Loops |
| TEST-009 | Loop module package/service/API/UI-testit, one-responsibility/done-condition conformance, install/export State/provenance/hash-roundtrip, capability swap, strict build gatet ja packaged Loop Library smoke. | module platform + project-local test suites |
| TEST-010 | Loop Engineer typed routing, pure projection, keyboard/UI sekä desktop/narrow browser -tarkistukset. | frontend ja module test suites |
| TEST-011 | `ExecutionComposition`, nykyinen Task Envelope sekä Codex/Copilot-adapteritestit: exact bytes/hash/order/schema, blocking composition ja no fallback. | execution/integration test suites |
| TEST-012 | `ExecutionStore.local`, `LocalExecutionQueue`, `LoopOrchestratorRecovery` ja `RootRunCancellationBarrier.persistence`: queued/running recovery, no replay/duplicate ja post-cancel barrier. | execution/runtime/run persistence test suites |
| TEST-013 | `loopRunViewModel` ja `runRuntimePanels`: snapshot/canonical mapping, repair/return/human/finalization ja forbidden invented telemetry. | frontend Run UI test suite |
| TEST-014 | Strict-v11 domain/schema/snapshot/persistence/runtime/API/module/routing/projection/UI hard cut -matriisi: zero/one/many flow, repair return, capability/allowlist, ambiguity/permission `needs_input`, Graph/Loop-datarajat, yhden vastuun project-local Loopit ja starter library, legacy-poisto sekä full test/lint/build/smoke/visual gate. | `graph-and-loop-engineering` initiative |
| TEST-015 | Strict-v12/v2 Workflow schema/runtime/Orchestrator/persistence/API/module/UI -matriisi: 1:1-paritus, exact Pass/Fail Edget, reachability, Job→Validation, PASS→Job/PASS, kolme retryä ja neljännen FAIL-eskalointi, same-Validation repair return ilman Job rerunia/retry resetiä, technical failure bypass, State/restart/cancel/recovery, atomic authoring, canvasilla vain composite Job-artworkit ja persisted `straight | smoothstep` Edget, nolla endpoint-nodea/validate/retry-viivaa, canonical routing, keyboard/a11y, desktop/narrow QA, v7 fail-closed, active legacy/boundary search ja full gates. | `workflow-engineering` initiative |
| TEST-016 | V13 schema- ja runtime-matriisi: 1/5/40 Loopia, invalid graphit, kaikki 18 oletustransitionia, snapshot immutability, 256-raja, Graph/Loop/scheduled-ajot, DONE ja repair call/return. | `graph-engineering-runbook` schema/runtime suites |
| TEST-017 | Transition editor, Run-kohteet, 1/5/40 deterministic layout, decision+outcome-accessibility, desktop/narrow Graph QA ja Workflow Engineeringin suojatun visuaalisen sopimuksen regressio-QA. | frontend suites + browser QA |
| TEST-018 | Hermetic `tk`-matriisi: success, timeout, malformed JSONL/Markdown, duplicate external-ref, dangling parent/dependency, cycle, partial write, restart, cancel, reconciliation ja yksi BUILD claim invocationissa; live smoke raportoidaan erikseen. | tracker/runtime suites + optional pinned `tk` smoke |
| TEST-019 | Strict-v14/v4/v7/v8/v9/v10 schema-, snapshot-, composition-, runtime-, persistence- ja Graph Node Module -matriisi: scoped start/continuation/repair-enumit, Graph/GraphNode dispatch, Work→Validation, bounded retry, Luna orchestrator invalid-target retry, local Sol Repair, Graph-eskalaatio, same-Validation LIFO-return, State patch, depth/attempt/transition-rajat, restart/cancel/no-duplicate, v9 fail-closed, kaikkien 14 paketin roundtrip/provenance/mapping ja active legacy/platform-boundary -haut. | `three-level-graph-node-engineering` backend/shared/module suites + final gates |
| TEST-020 | Kolmen canonical authoring-routen ja kahden Run-routen projection/UI/browser-matriisi: Graph/Graph Node planet/multi-ring -regressio, Job industrial flow'n pure layout/ghost/retry/interaction-semantics, inspector/Sheet, active Run -lukot, keyboard/a11y, reduced motion sekä 1440×900/390×844 overflow/visual QA. | frontend suites + browser QA + human visual review |
| TEST-021 | Strict-v15/v8/v11 SSP/SMDP-matriisi: decision feature/state/schema, arbitrary GraphNode metamorphic fixtures, hard admissibility/authorization, exact ppm/microcost validation, proper-policy analysis, Bellman convergence/tie/numeric/time/size bounds, snapshot/hash, atomic decision/dispatch/observation, restart/no-duplicate, explicit agent/ssp no-fallback, structured Configure editor/preview, bounded Run projection, repeated factual execution occurrence, 1/5/40 schema/layout ja platform-name coupling audit. Cancel-race stress ja max-bound/cross-host benchmark raportoidaan erikseen. | `stochastic-policy-orchestration` shared/backend/frontend/browser/conformance suites |
| TEST-022 | Strict-v17/v5/v10/v13 hierarchical SSP v2 -matriisi: global/local schema, exact outcome/PPM/result-semantics, guardien jälkeinen proper policy, reachable local readiness, no fallback, scoped dispatch ja immutable provenance sekä 1/5/40 × 1/17/64 scale. | `outcome-aware-hierarchical-policy` shared/backend/module/runtime suites |
| TEST-023 | Observation-matriisi: intrinsic outcome enum, PASS/FAIL consistency, projector-owned actual state, `match | outcome_miss | state_miss | outside_support`, measured/unknown provider-neutral cost dimensions, inclusive scope attribution, child links, unknown-state `needs_input`, no prior mutation ja restart/no-duplicate. | `outcome-aware-hierarchical-policy` projector/runtime/persistence suites |
| TEST-024 | Capability-first UI -matriisi: canonical section URLs, GraphNode/Action Node CRUD ja atomic refs, compile readiness, Graph Reward Decision Modelin pulse/horizon/impact/heatmap, ihmisyksiköt exact-detailillä, transition-mallittoman option näkyvyys, ei primary form/table -pintaa, protected Action-flow regression, keyboard/focus, long IDs, error states, desktop/narrow sekä scale fixtures. | `capability-first-authoring` ja `graph-reward-mdp` frontend/browser suites |
| TEST-025 | Governed calibration/promotion -matriisi: versioned provider-neutral option dimensions ja unknown-semantics, hierarchy-safe attribution, immutable dataset/model/report hashes ja lineage, explicit priors/sample/coverage gates, joint outcome×actual-state ja cost estimation, exact/seeded/held-out/sensitivity evaluation, shadow/controller separation, zero counterfactual evidence, proposal thresholds, human activation/rollback, future-run-only snapshot effect ja restart/no-duplicate. | `governed-policy-calibration-and-promotion` contract/persistence/calibration/evaluation/runtime suites + human activation audit |
| TEST-026 | Strict Reward-MDP -matriisi: v18/v3/v6/v11/v9/v10/v11/v4/v14 schema, acceptance delta/immutability, exact default PPM/provenance, outcome-aware reward/Q, hard authorization, canonical deterministic compiler/tie/absorption/hash, one-time policy snapshot/lookup, ordered Action Node Work→Validation, retry/escalate, restart/idempotenssi, real choice/DONE hermetic Run, legacy absence, UI pulse/horizon/reward-impact/relative V-landscape/acceptance detail, protected desktop/narrow flow, full test/lint/build/design/module/boundary/diff/latest/startup gates. | `graph-reward-mdp` compiler/runtime/frontend/conformance suites + repository final gates |
| TEST-027 | Strict v19/v4/v7/v12/v5/v15 hierarchical Reward-MDP -matriisi: node-derived ID:t, explicit initial, sparse required cells, unique outcome/exact PPM/terminal/guard/authorization/absorption; bound-only Graph reward, zero unbound/split/duplicate progress ja once-only local terminal bonus; global→local→Action→local→global, backtrack/retry/exhaustion/escalate/mismatch/restart/out-of-contract/256-raja; +10 nodea→15×15 ilman ledger-kasvua, atomic rename/delete, Module v7 roundtrip; Graph 5×5, PLAN 2×2, DESIGN 12×12, 1/5/40 × 1/17/64 CSS-grid/virtualization/keyboard/reduced-motion/desktop/narrow; full test/lint/build/arc42/DESIGN/module/boundary/diff/latest/startup gates. | `hierarchical-reward-mdp` shared/backend/frontend/module/conformance suites + repository final gates |
| TEST-028 | Project Config v20/Root Snapshot v13/role v10 -matriisi: approved Use Case trace, unique positive State order ja Action priority, JSON-permutaatio, all-Actions-done gate, immutable snapshot, precheck/Work/postwork enumit, dynamic prompt/permissions, maxRetries 0/2/5, provider failure ≠ semantic retry ja standalone State/Action Run -poisto. | `environment-state-action-orchestration` shared/project/planner/runtime/provider suites |
| TEST-029 | Feedback/Critic/approval-matriisi: atomic blocked+Feedback, restart/no-duplicate, interval/timezone/due/lease/recovery, immutable Critic read set, proposal lifecycle, zero pre-approval Feedback/write, human identity+expected revision, stale/duplicate/agent approval ja successful-worktree read retention. | `environment-state-action-orchestration` persistence/schedule/critic/approval/audit suites |
| TEST-030 | Refinement/apply/continuation-matriisi: allowed paths, shared Skill reverse-impact, exact base/diff/preimage hashes, read-only proposal, human approval, active-run lock, stale/conflict rollback, one managed-worktree commit, immutable parent, one continuation Run, lineage ja Product Snapshot projection. | `environment-state-action-orchestration` refinement/git/runtime/projection suites |
| TEST-031 | Target UI -matriisi: Direction, Use Cases, Environment/State/Action, Validation flow, Run Gate, Feedback Box, Critic review, exact refinement approval ja Product Snapshot; canonical route state, factual DTO:t, keyboard/focus, color-independent labels, reduced motion sekä 1440×900/390×844 overflow/console QA. | `environment-state-action-orchestration` frontend/component/browser/a11y suites |
| TEST-032 | Phase-09 strict cutover -matriisi: v19/vNext cross-read/write sentinel, fresh SQLite v16 fail-closed start, exact target version assertions, canonical API/UI route replacement, removal-manifest grep-gatet sekä full test/lint/build/arc42/DESIGN/package/install/API/UI/release smoke/latest/startup ja clean tree. | `environment-state-action-orchestration` conformance/release suites + repository final gates |

## Evidenssikatalogi

| ID | Evidenssi | Sijainti |
| --- | --- | --- |
| EVID-001 | Automatisoidut local service- ja HTTP-testitulokset. | `npm run test` |
| EVID-002 | Strict project schema- ja resource resolution -tulokset. | `npm run validate:arc42`, `npm run test` |
| EVID-003 | Workflow runtime- ja persistence-tulokset. | `npm run test` |
| EVID-004 | Worktree- ja permission-policy-tulokset. | `npm run test` |
| EVID-005 | arc42 repository conformance -raportti. | `npm run validate:arc42` |
| EVID-006 | Initiative BRIEF/PLAN/EVIDENCE/REVIEW-ketju. | pending ensimmäinen end-to-end-initiative |
| EVID-007 | Ihmisvaltuutus sekä release/deploy/rollback-tarkistukset. | pending eksplisiittisesti valtuutettu release |
| EVID-008 | Ennen/jälkeen method metrics. | pending ensimmäinen pilottiarvio |
| EVID-009 | Asennettavien Loop modulejen initiative-evidenssi. | `.ballet/arc42/initiatives/installable-loop-modules/EVIDENCE.md` |
| EVID-010 | Kolmitasoisen Loop Engineerin implementation-evidenssi. | `.ballet/arc42/initiatives/loop-engineer-three-level-canvas/EVIDENCE.md` |
| EVID-011 | Exact composition/Task Envelope/adapter -testitulokset ja dokumentoitu no-fallback-invariantti. | `.ballet/arc42/initiatives/comprehensive-arc42-documentation/EVIDENCE.md`, TEST-011-output |
| EVID-012 | Restart/reconciliation/cancellation-testitulokset: queued säilyy, running ei replaya, committed vaikutus ei duplikoidu. | `.ballet/arc42/initiatives/comprehensive-arc42-documentation/EVIDENCE.md`, TEST-012-output |
| EVID-013 | Run view-model/panel -testitulokset ja canonical source -katselmointi ilman keksittyä telemetriaa. | `.ballet/arc42/initiatives/comprehensive-arc42-documentation/EVIDENCE.md`, TEST-013-output |
| EVID-014 | Graph Engineering / Loop Engineering strict-v11 implementation-, Phase 6 responsibility/library-, conformance- ja ihmisacceptance-evidenssi. | `.ballet/arc42/initiatives/graph-and-loop-engineering/EVIDENCE.md`; GLE-EVID-002–008A ja current-baseline-audit GLE-EVID-006B passed, human acceptance pending |
| EVID-015 | Workflow Engineering strict-v12/v2 implementation-, conformance-, gate- ja ihmisacceptance-evidenssi. | `.ballet/arc42/initiatives/workflow-engineering/EVIDENCE.md`; WFE-EVID-001–007 ja WFE-EVID-009 passed, WFE-EVID-008 pending |
| EVID-016 | Strict-v13 named RunBookin schema/runtime/root-kind/snapshot/limit/repair-tulokset; paikallisesti verified 2026-08-21. | `.ballet/arc42/initiatives/graph-engineering-runbook/EVIDENCE.md`; GER-EVID-001/003/006 |
| EVID-017 | Graph UI:n 1/5/40-layout-, a11y- ja desktop/narrow-kuvat sekä Workflow regression -kuvat; technical/browser verified, ihmisverdict pending. | `.ballet/arc42/initiatives/graph-engineering-runbook/EVIDENCE.md`; GER-EVID-005 |
| EVID-018 | Tracker adapter/outbox/reconciliation/fault-matrix verified hermetic; pinnattu live-smoke pending, koska `tk` puuttuu PATHista. | `.ballet/arc42/initiatives/graph-engineering-runbook/EVIDENCE.md`; GER-EVID-002/006/007 |
| EVID-019 | Strict-v14 Graph/GraphNode/JobNode-domainin, agent routing/repairin, compositionin, SQLite v10:n ja 14 Graph Node Module v4 -paketin tekninen/conformance-evidenssi. | `.ballet/arc42/initiatives/three-level-graph-node-engineering/EVIDENCE.md`; TGNE-EVID-001–003/005 |
| EVID-020 | Graph/Graph Node -avaruuscanvasien ja Job industrial flow -canvasin route-, a11y-, layout-, desktop/narrow-browser- ja ihmisvisual-evidenssi. | `.ballet/arc42/initiatives/three-level-graph-node-engineering/EVIDENCE.md`; `.ballet/arc42/initiatives/job-node-industrial-flow-canvas/EVIDENCE.md` |
| EVID-021 | Accepted finite SSP/SMDP Graph-policy architecture, human decision, TEST-021 generic core -evidenssi sekä avoimet projection/benchmark/pilot-rajat. | `.ballet/arc42/initiatives/stochastic-policy-orchestration/EVIDENCE.md`; SPO-EVID-000–006 |
| EVID-022 | Outcome-aware global/local compiler-, solver-, snapshot-, module- ja runtime-evidenssi; calibrated pilot pysyy erillisenä pending-raja-arvona. | `.ballet/arc42/initiatives/outcome-aware-hierarchical-policy/EVIDENCE.md`; OHP-EVID-001/003–006 |
| EVID-023 | Projector-owned actual state, neljän model-miss-luokan ja no-prior-mutationin evidenssi. | `.ballet/arc42/initiatives/outcome-aware-hierarchical-policy/EVIDENCE.md`; OHP-EVID-002/004/006 |
| EVID-024 | Capability-first route/card/CRUD/readiness/Run/Job-regression sekä desktop/narrow-evidenssi. | `.ballet/arc42/initiatives/capability-first-authoring/EVIDENCE.md`; CFA-EVID-001–005 |
| EVID-025 | Provider-neutral option-cost-, offline calibration-, immutable registry-, evaluation-, shadow-, proposal-, human activation- ja rollback-ketju. | `.ballet/arc42/initiatives/governed-policy-calibration-and-promotion/EVIDENCE.md`; GPCP-EVID-001/002 verified locally, GPCP-EVID-003–007 pending |
| EVID-026 | Graph Reward-MDP strict cutin implementation-, compiler/runtime-, UI-, documentation- ja final-gate-evidenssi. | `.ballet/arc42/initiatives/graph-reward-mdp/EVIDENCE.md`; GRM-evid-001–005 |
| EVID-027 | Hierarchical Reward-MDP:n contract/compiler/runtime/CRUD/module/UI/documentation/final-gate-evidenssi. | `.ballet/arc42/initiatives/hierarchical-reward-mdp/EVIDENCE.md`; HRM-evid-001–006 |
| EVID-028 | Approved Use Case-, ordering-, Validation-led gate/retry- ja immutable Environment Run -evidenssi. | `.ballet/arc42/initiatives/environment-state-action-orchestration/EVIDENCE.md`; implementation evidence pending |
| EVID-029 | Atomic Feedback-, Critic schedule/proposal-, human approval- ja worktree retention -evidenssi. | `.ballet/arc42/initiatives/environment-state-action-orchestration/EVIDENCE.md`; implementation evidence pending |
| EVID-030 | Exact refinement-, managed commit-, continuation lineage- ja Product Snapshot -evidenssi. | `.ballet/arc42/initiatives/environment-state-action-orchestration/EVIDENCE.md`; implementation evidence pending |
| EVID-031 | Target responsive/accessibility/browser- ja factual projection -evidenssi. | `.ballet/arc42/initiatives/environment-state-action-orchestration/EVIDENCE.md`; implementation evidence pending |
| EVID-032 | Strict cutover removal-, cross-store-, version-, release-, install- ja startup-evidenssi. | `.ballet/arc42/initiatives/environment-state-action-orchestration/EVIDENCE.md`; implementation evidence pending |

## Ketjun tulkinta

Goal/REQ ja QS nimeävät tavoitteen sekä mitan. ADR/CON selittää ratkaisun, BB/RT/DEP näyttää sen toteutuspaikan ja ajopolun, TEST/monitor tuottaa havainnon ja EVID indeksoi todellisen tuloksen. Puuttuva rengas pysyy pending-findinginä; sitä ei korvata yleisellä `npm test passed` -väitteellä, jos kyseinen kriteeri ei ole testissä havaittava.

## Kanoniset lähteet

Goalit, laatuskenaariot, ADR:t/konseptit, building blockit, runtime/deployment-skenaariot ja evidenssikatalogit pysyvät kanonisina omissa tiedostoissaan. Tämä tiedosto omistaa vain niiden välisen suhteen ja trace-statuksen.

## Relevantit päätökset

`adr-011`, `adr-015`, `adr-016`, `adr-025`, `adr-027`, `adr-029` säilyvin osin, aktiivinen `adr-033` sekä target `adr-034`; superseded/historialliset ketjut säilyvät audit trailina.

## Evidenssi

Project-local-validator hylkää tuntemattomat trace-ID:t ja puutteelliset quality scenario -kentät. Conformance review tarkistaa lisäksi kaikkien 22 Goal/REQ-parien kattavuuden ja pitää accepted-target/pending-evidenssin erossa toteutetusta hyväksynnästä.

## Avoimet kysymykset

- Pilot- ja release-pending-evidenssiä ei saa nostaa verified-tilaan ilman konkreettista artifact referenceä.
- EVID-011–EVID-013:n tai EVID-027:n paikallinen verification ei korvaa production-pilottia tai ihmisarviota.
- EVID-028–EVID-032 pysyvät pending, kunnes implementation-vaiheet tuottavat exact test outputit, artifact-viitteet ja tarvittavat ihmisverdictit.

## Seuraava katselmointiperuste

Päivitä, kun stable ID lisätään, poistetaan, supersedoidaan tai trace-status muuttuu uuden evidenssin perusteella.
