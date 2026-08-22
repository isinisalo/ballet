---
id: stochastic-policy-orchestration-evidence
title: Stochastic Policy Orchestration EVIDENCE
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 4
tags:
  - arc42
  - initiative
  - evidence
  - ssp
---

# Stochastic Policy Orchestration EVIDENCE

## Evidenssirekisteri

| Evidence ID | QS/requirement | Tarkistus tai havainto | Artefaktit | Tulos | Timestamp/source | Rajoitus |
| --- | --- | --- | --- | --- | --- | --- |
| SPO-EVID-000 | REQ-016 / QS-021 | Ihmisen päätös strategy-, proper-policy-, solver-bound- ja version-cut-kysymyksiin. | SPO-OQ-001–004, `goal-016`, `adr-026` | passed | 2026-08-22 project owner approval in implementation task | Kaikki neljä kysymystä hyväksyttiin draftin mukaisesti. |
| SPO-EVID-001 | REQ-002 / REQ-016 / QS-021 | Strict decision model schema ja arbitrary-node metamorphic fixture. | `shared/domain/decisionModel.ts`, `shared/api/decision-model-schemas.ts`, `backend/tests/projectConfigV15Policy.test.ts` | passed | 2026-08-22; full test run 186/186 | 1/5/40, add/delete/full rename/reorder, stale-reference ja transition-outcome-bound on katettu; UI:n täysi model editor kuuluu seuraavaan sliceen. |
| SPO-EVID-002 | REQ-006 / REQ-016 / QS-021 | Bounded Decision State ja hard admissibility. | `backend/policy/DecisionStateProjector.ts`, `DecisionStateProjector.test.ts`, `AdmissibleActionResolver.ts`, `PolicyRuntimeIntegration.test.ts` | passed core | 2026-08-22; full test run 186/186 | Runtime/project State/authorization source, missing/domain failure ja guard-denial katettu; domain fitness vaatii pilotin. |
| SPO-EVID-003 | REQ-016 / QS-021 | Pure solver, proper-policy, convergence, tie ja failure matrix. | `backend/policy/SspPolicySolver.ts`, `SspPolicySolver.test.ts` | passed | 2026-08-22; 10 solver fixtures, full test run 186/186 | Cross-host numeric reproducibility ja 1 024-state performance tarvitsevat myöhemmän benchmark-evidenssin. |
| SPO-EVID-004 | REQ-006 / REQ-016 / QS-012 / QS-021 | Snapshot/persistence/restart/no-fallback. | Snapshot v8, SQLite v11, `PolicyEvidenceStore.ts`, `PolicyRuntimeIntegration.test.ts` | passed core | 2026-08-22; full test run 186/186 | Immutable Configure-edit, atomic start decision/dispatch rollback, decision/observation, restart, outcome deviation ja zero-dispatch failure katettu; SSP-spesifi cancel-race stressi jää seuraavaan sliceen. |
| SPO-EVID-005 | REQ-007 / REQ-016 / QS-013 / QS-020 / QS-021 | Configure/Run projections ja policy preview/execution truth -raja. | strict config/API schemas, strategy-aware protected Graph canvas, Run DTO policy evidence | partial | 2026-08-22 build passed | Täysi Decision Model editor ja bounded visual Policy Projection eivät kuulu core-sliceen. |
| SPO-EVID-006 | REQ-016 / QS-021 | Full gate ja conformance. | TEST-021 command matrix | passed core | 2026-08-22; test 186/186, lint 0 errors/8 warnings, build, arc42, DESIGN lint, diff, release/install/restart/status and conformance passed | Full editor/projection, max-bound benchmark, cancel-race stress ja pilot ovat seuraavan slicen acceptancea. |
| SPO-EVID-ARCH-001 | REQ-002 / REQ-006 / REQ-007 / REQ-016 | Architecture-, domain-, parser-, snapshot-, runtime-, SQLite-, Configure/Run- ja testipinnan inspection sekä implementation-ready draft. | `goal-016`, `adr-026`, REQ/QS/CON/BB/RT/RISK/TEST/EVID-ketju, initiative BRIEF/PLAN/REVIEW | passed historical architecture-only | 2026-08-22 pre-approval local source review | Tämä rivi edelsi myöhempää human approvalia ja runtime-implementationia. |
| SPO-EVID-ARCH-002 | QS-005 / QS-021 | Arc42/link/trace validation, coupling audit, diff check, release build/install/restart/status. | `npm run validate:arc42`, scoped source searches, `git diff --check`, `make latest` | passed | 2026-08-22 local; 68 unique document IDs; healthy service at checkout-local loopback | Build/start todentaa unchanged active baselinea, ei TEST-021-policy behavioria. Generic `package` ja JS `prototype` -osumat eivät ole GraphNode-ID branchingia. |

## Implementation evidence

- Strict v15 parseri validoi strategy unionin, finite feature/state/action/transition/cost/terminal/solver-mallin, stale GraphNode -viitteet, exact ppm-summat, guard-domainit ja proper-policy-alueen.
- Pure solver käyttää bounded undiscounted Bellman value iterationia, Kahan-summausta, almost-sure-winning preflightia, selected-policy recurrent-class -tarkistusta ja stable ID -tasatilanneratkaisua.
- Snapshot v8 sisältää Graph-strategian, Capability Graphin, Decision Modelin sekä canonical hashit. SQLite v11 erottaa agent routing -evidenssin SSP decision/option observation -evidenssistä.
- Runtime-testissä hard guard poistaa halvemman actionin ennen Q-laskentaa, FAIL-observation projisoi uuden Decision Staten ja valitsee eri recovery-GraphNoden; restart säilyttää decision-evidenssin identtisenä.
- `npm run test` läpäisi 46 tiedostoa ja 186 testiä; `npm run build`, `npm run validate:arc42`, DESIGN-lint, `git diff --check` ja `make latest` läpäisivät; `npm run lint` läpäisi 0 errorilla ja kahdeksalla kokorajojen/complexityn warningilla.
- Conformance review löysi ensin kaksi evidence-gap-findingsiä: vain yhden ID:n rename-fixturen sekä suoran bounded source -testin puuttumisen. Local retry lisäsi kokonaan uudelleennimetyn graphin ja runtime/State/authorization/missing/domain-projektiotestit; uusintakatselmointi ei löytänyt core-slicestä implementation defectiä tai platform-name couplingia.

## Avoimet evidenssiaukot

- Domain expertin kalibroimat probability/cost-priorit.
- Numeric reproducibility eri supported hosteilla ja bounded performance 1 024 state -rajalla.
- First pilotin transition calibration, observed cost dimensions ja Decision State Markov-gap review.
- Täysi Configure Decision Model editor, bounded Policy Projection ja niiden human usability review.
- SSP-spesifi cancel/race-stressi ja tuotantokaltainen provider-pilotti.

## Seuraava review-raja

Generic runtime-core on hyväksymiskelpoinen. Seuraava review rajaa täyden Configure-editorin, bounded visual Policy Projectionin, max-bound/cross-host-evidenssin, cancel-race-stressin ja domain-kalibroidun pilotin erilliseksi sliceiksi.
