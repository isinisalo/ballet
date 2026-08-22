---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 16
tags:
  - arc42
  - traceability
  - evidence
---

# Balletin arkkitehtuurin jäljitettävyys

## Tarkoitus

Tämä tiedosto yhdistää hyväksytyn intentin mitattavaan evidenssiin kopioimatta stable ID:iden omistamaa kanonista sisältöä. Jokaisella `goal-001`–`goal-015` / `REQ-001`–`REQ-015` -parilla on vähintään yksi havaittava QS–ratkaisu–testi–evidenssi-ketju.

## Tila

Matriisi sisältää 20 laatuketjua. QS-001–QS-018 säilyttävät aiemman hyväksytyn tai historiallisen evidenssin. QS-019/020 muodostavat strict-v14 Graph Node Engineeringin uuden acceptance-ketjun; technical/conformance- ja browser-portit läpäisevät, ihmisvisual verdict ja tuotantokaltainen provider-pilotti säilyvät avoimina.

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
| goal-015 / REQ-015 | QS-020 | adr-023 / CON-005 / CON-011 | BB-001 / BB-002 / BB-009 | RT-014 / DEP-001 | TEST-020 | EVID-020 | technical/browser passed; human visual verdict pending |
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
| TEST-020 | Kolmen canonical authoring-routen ja kahden Run-routen projection/UI/browser-matriisi: breadcrumb/back-forward, direct drill-down, scope, inspector/Sheet, active Run -lukot, keyboard/a11y, reduced motion, 1/5/40 GraphNode- ja 1/17/64 JobNode -layoutit 1440×900/390×844-viewporteissa sekä avaruusteeman visuaalinen regressio. | frontend suites + browser QA + human visual review |

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
| EVID-020 | Kolmen scopetun avaruuscanvasin route-, a11y-, layout-, desktop/narrow-browser- ja ihmisvisual-evidenssi. | `.ballet/arc42/initiatives/three-level-graph-node-engineering/EVIDENCE.md`; TGNE-EVID-004/005 |

## Ketjun tulkinta

Goal/REQ ja QS nimeävät tavoitteen sekä mitan. ADR/CON selittää ratkaisun, BB/RT/DEP näyttää sen toteutuspaikan ja ajopolun, TEST/monitor tuottaa havainnon ja EVID indeksoi todellisen tuloksen. Puuttuva rengas pysyy pending-findinginä; sitä ei korvata yleisellä `npm test passed` -väitteellä, jos kyseinen kriteeri ei ole testissä havaittava.

## Kanoniset lähteet

Goalit, laatuskenaariot, ADR:t/konseptit, building blockit, runtime/deployment-skenaariot ja evidenssikatalogit pysyvät kanonisina omissa tiedostoissaan. Tämä tiedosto omistaa vain niiden välisen suhteen ja trace-statuksen.

## Relevantit päätökset

`adr-011`, `adr-015`, `adr-016` ja `adr-023` sekä historiallisten ketjujen ADR-017/020/021/022.

## Evidenssi

Project-local-validator hylkää tuntemattomat trace-ID:t ja puutteelliset quality scenario -kentät. Conformance review tarkistaa lisäksi kaikkien 14 Goal/REQ-parien kattavuuden.

## Avoimet kysymykset

- Pilot- ja release-pending-evidenssiä ei saa nostaa verified-tilaan ilman konkreettista artifact referenceä.
- EVID-011–EVID-013:n paikallinen verification ei korvaa production-pilottia tai ihmisarviota.

## Seuraava katselmointiperuste

Päivitä, kun stable ID lisätään, poistetaan, supersedoidaan tai trace-status muuttuu uuden evidenssin perusteella.
