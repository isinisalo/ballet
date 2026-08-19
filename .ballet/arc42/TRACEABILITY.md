---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-19'
version: 6
tags:
  - arc42
  - traceability
  - evidence
---

# Balletin arkkitehtuurin jäljitettävyys

## Tarkoitus

Tämä tiedosto yhdistää hyväksytyn intentin mitattavaan evidenssiin kopioimatta stable ID:iden omistamaa kanonista sisältöä. Jokaisella `goal-001`–`goal-012` / `REQ-001`–`REQ-012` -parilla on vähintään yksi havaittava QS–ratkaisu–testi–evidenssi-ketju.

## Tila

Matriisi sisältää 14 laatuketjua. QS-011–QS-013:n paikallinen evidenssi on verified 2026-08-17 ajettujen nimettyjen testien ja dokumentaation lopputarkistuksen perusteella. QS-014:n päätös on accepted ja sen data/config/snapshot/module-osavaiheella on GLE-EVID-002/003/008; koko implementation- ja ihmisacceptance-evidenssi on pending.

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
| goal-010 / REQ-010 | QS-009 | adr-016 / CON-007 | BB-001 / BB-002 / BB-003 / BB-009 | RT-006 / RT-007 / DEP-001 | TEST-009 | EVID-009 | implementation verified; full gate pending |
| goal-011 / REQ-011 | QS-010 | adr-017 / CON-005 | BB-001 / BB-009 | RT-006 / DEP-001 | TEST-010 | EVID-010 | verified |
| goal-012 / REQ-012 | QS-014 | adr-018 / CON-002 / CON-005 | BB-001 / BB-003 / BB-004 / BB-005 / BB-006 / BB-009 | RT-011 / DEP-001 / DEP-002 | TEST-014 | EVID-014 | data/config/snapshot/module passed; dispatch/UI/human acceptance pending |
<!-- traceability:end -->

## Testi- ja monitorikatalogi

| ID | Tarkistus | Omistaja |
| --- | --- | --- |
| TEST-001 | Local server-, API security- ja checkout lifecycle -testit. | platform test suite |
| TEST-002 | Strict project configuration- ja resource catalog -testit. | project configuration tests |
| TEST-003 | Work Loop-, State patch-, repair allowlist- ja continuation-testit. | runtime test suite |
| TEST-004 | Git workspace- ja permission-policy-testit. | execution test suite |
| TEST-005 | `npm run validate:arc42`: rakenne, linkit, stable ID:t, trace ja project resources. | project-local validator |
| TEST-006 | Ensimmäisen initiativen trace completeness ja handoff review. | arc42 evaluate Loop |
| TEST-007 | Release authorization gate ja release-validation-evidenssi. | release-validation Loop |
| TEST-008 | METHOD-HEALTH-vertailu ensimmäisen pilotin baselineen. | continuous learning / evaluate Loops |
| TEST-009 | Loop module package/service/API/UI-testit, strict build gatet ja packaged Loop Library smoke. | module platform test suite |
| TEST-010 | Loop Engineer typed routing, pure projection, keyboard/UI sekä desktop/narrow browser -tarkistukset. | frontend ja module test suites |
| TEST-011 | `ExecutionComposition`, `TaskEnvelopeV3` sekä Codex/Copilot-adapteritestit: exact bytes/hash/order/schema, blocking composition ja no fallback. | execution/integration test suites |
| TEST-012 | `ExecutionStore.local`, `LocalExecutionQueue`, `LoopOrchestratorRecovery` ja `RootRunCancellationBarrier.persistence`: queued/running recovery, no replay/duplicate ja post-cancel barrier. | execution/runtime/run persistence test suites |
| TEST-013 | `loopRunViewModel` ja `runRuntimePanels`: snapshot/canonical mapping, repair/return/human/finalization ja forbidden invented telemetry. | frontend Run UI test suite |
| TEST-014 | Strict-v11 domain/schema/snapshot/persistence/runtime/API/module/routing/projection/UI hard cut -matriisi: zero/one/many flow, repair return, capability/allowlist, ambiguity/permission `needs_input`, Graph/Loop-datarajat, legacy-poisto, full test/lint/build/smoke/visual gate. | `graph-and-loop-engineering` initiative |

## Evidenssikatalogi

| ID | Evidenssi | Sijainti |
| --- | --- | --- |
| EVID-001 | Automatisoidut local service- ja HTTP-testitulokset. | `npm run test` |
| EVID-002 | Strict-v10 schema- ja resource resolution -tulokset. | `npm run validate:arc42`, `npm run test` |
| EVID-003 | Work Loop runtime- ja persistence-tulokset. | `npm run test` |
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
| EVID-014 | Graph Engineering / Loop Engineering strict-v11 implementation-, conformance- ja ihmisacceptance-evidenssi. | `.ballet/arc42/initiatives/graph-and-loop-engineering/EVIDENCE.md`; pending |

## Ketjun tulkinta

Goal/REQ ja QS nimeävät tavoitteen sekä mitan. ADR/CON selittää ratkaisun, BB/RT/DEP näyttää sen toteutuspaikan ja ajopolun, TEST/monitor tuottaa havainnon ja EVID indeksoi todellisen tuloksen. Puuttuva rengas pysyy pending-findinginä; sitä ei korvata yleisellä `npm test passed` -väitteellä, jos kyseinen kriteeri ei ole testissä havaittava.

## Kanoniset lähteet

Goalit, laatuskenaariot, ADR:t/konseptit, building blockit, runtime/deployment-skenaariot ja evidenssikatalogit pysyvät kanonisina omissa tiedostoissaan. Tämä tiedosto omistaa vain niiden välisen suhteen ja trace-statuksen.

## Relevantit päätökset

`adr-011`, `adr-015`, `adr-016`, `adr-017` ja `adr-018`.

## Evidenssi

Project-local-validator hylkää tuntemattomat trace-ID:t ja puutteelliset quality scenario -kentät. Dokumentaatioinitiativen conformance review tarkistaa lisäksi kaikkien 11 Goal/REQ-parien kattavuuden.

## Avoimet kysymykset

- Pilot- ja release-pending-evidenssiä ei saa nostaa verified-tilaan ilman konkreettista artifact referenceä.
- EVID-011–EVID-013:n paikallinen verification ei korvaa production-pilottia tai ihmisarviota.

## Seuraava katselmointiperuste

Päivitä, kun stable ID lisätään, poistetaan, supersedoidaan tai trace-status muuttuu uuden evidenssin perusteella.
