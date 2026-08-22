---
id: stochastic-policy-orchestration-evidence
title: Stochastic Policy Orchestration EVIDENCE
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 5
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
| SPO-EVID-001 | REQ-002 / REQ-016 / QS-021 | Strict decision model schema ja arbitrary-node metamorphic fixture. | `shared/domain/decisionModel.ts`, `shared/api/decision-model-schemas.ts`, `backend/tests/projectConfigV15Policy.test.ts`, `frontend/tests/graphNodeAuthoring.test.ts` | passed | 2026-08-22; full test run 194/194 | 1/5/40, add/delete/full rename/reorder, stale-reference, explicit composition ja transition-outcome-bound on katettu; production UI:ssa ei ole oletus-GraphNode-ID-haaraa. |
| SPO-EVID-002 | REQ-006 / REQ-016 / QS-021 | Bounded Decision State ja hard admissibility. | `backend/policy/DecisionStateProjector.ts`, `DecisionStateProjector.test.ts`, `AdmissibleActionResolver.ts`, `PolicyRuntimeIntegration.test.ts` | passed core | 2026-08-22; full test run 186/186 | Runtime/project State/authorization source, missing/domain failure ja guard-denial katettu; domain fitness vaatii pilotin. |
| SPO-EVID-003 | REQ-016 / QS-021 | Pure solver, proper-policy, convergence, tie ja failure matrix. | `backend/policy/SspPolicySolver.ts`, `SspPolicySolver.test.ts` | passed | 2026-08-22; 10 solver fixtures, full test run 186/186 | Cross-host numeric reproducibility ja 1 024-state performance tarvitsevat myöhemmän benchmark-evidenssin. |
| SPO-EVID-004 | REQ-006 / REQ-016 / QS-012 / QS-021 | Snapshot/persistence/restart/no-fallback. | Snapshot v8, SQLite v11, `PolicyEvidenceStore.ts`, `PolicyRuntimeIntegration.test.ts` | passed core | 2026-08-22; full test run 186/186 | Immutable Configure-edit, atomic start decision/dispatch rollback, decision/observation, restart, outcome deviation ja zero-dispatch failure katettu; SSP-spesifi cancel-race stressi jää seuraavaan sliceen. |
| SPO-EVID-005 | REQ-007 / REQ-016 / QS-013 / QS-020 / QS-021 | Configure/Run projections ja policy preview/execution truth -raja. | `DecisionModelEditor.tsx`, `PolicyProjection.ts`, `PolicyRunReadModel.ts`, `RunPolicyViews.tsx`, strict API read models ja protected Graph canvas | passed UI slice | 2026-08-22; 194/194 tests, build ja 1440×900 / 390×844 Playwright QA | Configure-preview on unsnapshotted derived evidence; Run-projection tulee immutable snapshotista ja Execution Graph append-only decision/observation/invocation-faktoista. Ihmisen domain-usability/pilottiverdict puuttuu. |
| SPO-EVID-006 | REQ-016 / QS-021 | Full gate ja conformance. | TEST-021 command matrix | passed local UI slice | 2026-08-22; test 194/194, lint 0 errors/10 warnings, build, arc42, diff, `make latest` ja installed service status passed | Max-bound benchmark, cross-host numeric evidence, cancel-race stress ja pilot ovat seuraavan slicen acceptancea. |
| SPO-EVID-ARCH-001 | REQ-002 / REQ-006 / REQ-007 / REQ-016 | Architecture-, domain-, parser-, snapshot-, runtime-, SQLite-, Configure/Run- ja testipinnan inspection sekä implementation-ready draft. | `goal-016`, `adr-026`, REQ/QS/CON/BB/RT/RISK/TEST/EVID-ketju, initiative BRIEF/PLAN/REVIEW | passed historical architecture-only | 2026-08-22 pre-approval local source review | Tämä rivi edelsi myöhempää human approvalia ja runtime-implementationia. |
| SPO-EVID-ARCH-002 | QS-005 / QS-021 | Arc42/link/trace validation, coupling audit, diff check, release build/install/restart/status. | `npm run validate:arc42`, scoped source searches, `git diff --check`, `make latest` | passed | 2026-08-22 local; 68 unique document IDs; healthy service at checkout-local loopback | Build/start todentaa unchanged active baselinea, ei TEST-021-policy behavioria. Generic `package` ja JS `prototype` -osumat eivät ole GraphNode-ID branchingia. |

## Implementation evidence

- Strict v15 parseri validoi strategy unionin, finite feature/state/action/transition/cost/terminal/solver-mallin, stale GraphNode -viitteet, exact ppm-summat, guard-domainit ja proper-policy-alueen.
- Pure solver käyttää bounded undiscounted Bellman value iterationia, Kahan-summausta, almost-sure-winning preflightia, selected-policy recurrent-class -tarkistusta ja stable ID -tasatilanneratkaisua.
- Snapshot v8 sisältää Graph-strategian, Capability Graphin, Decision Modelin sekä canonical hashit. SQLite v11 erottaa agent routing -evidenssin SSP decision/option observation -evidenssistä.
- Runtime-testissä hard guard poistaa halvemman actionin ennen Q-laskentaa, FAIL-observation projisoi uuden Decision Staten ja valitsee eri recovery-GraphNoden; restart säilyttää decision-evidenssin identtisenä.
- Configure tarjoaa arbitrary GraphNode add/rename/delete -draftit, atomisen SSP action/guard-domain/reference-renamen, stale-rowt poistavan deleten, structured feature/state/guard/prior/cost/terminal-editorin ja fail-closed server-preview-validoinnin ennen Savea.
- Policy Projection ratkaistaan snapshottatusta tai unsnapshotted draft -mallista, rollataan deterministic 20 epochin / 100 noden rajaan ja katkaistaan cycle/horizon-rajoilla. Execution Graph rekonstruoi jokaisen valitun GraphNode-occurrencen erikseen, joten toistot säilyvät näkyvinä.
- Run erottaa immutable Capability Graphin, persisted current decision/Q/V-evidenssin, derived expected projectionin, factual execution trajectoryn ja empirical telemetryn. Configured prior/cost ja observed outcome/duration/cost on nimetty eri totuusrajoiksi eikä observation mutatoi modelia.
- UI-slicen paikallinen `npm run test` läpäisi 49 tiedostoa ja 194 testiä; `npm run build`, `npm run validate:arc42`, `git diff --check` ja `make latest` läpäisivät. `npm run lint` läpäisi 0 errorilla ja kymmenellä kokorajojen/complexityn warningilla. Installed launchd-palvelu raportoi `loaded: true` ja `running: true`.
- Playwright QA käytti erillistä temporary SSP-fixtureä (`intake`, `threat-model`, `implement`, `benchmark`, `ship`) desktopilla 1440×900 ja narrow-viewportissa 390×844. Tarkistetut pinnat olivat protected Capability Graph, Decision Model, Configure Policy Preview, Run current decision/projection/execution, repeated occurrence -trajectory sekä desktop inspector/narrow Sheet; ainoa browser-console error oli puuttuva `favicon.ico`.
- Conformance review löysi ensin kaksi evidence-gap-findingsiä: vain yhden ID:n rename-fixturen sekä suoran bounded source -testin puuttumisen. Local retry lisäsi kokonaan uudelleennimetyn graphin ja runtime/State/authorization/missing/domain-projektiotestit; uusintakatselmointi ei löytänyt core-slicestä implementation defectiä tai platform-name couplingia.

## Avoimet evidenssiaukot

- Domain expertin kalibroimat probability/cost-priorit.
- Numeric reproducibility eri supported hosteilla ja bounded performance 1 024 state -rajalla.
- First pilotin transition calibration, observed cost dimensions ja Decision State Markov-gap review.
- Domain expertin human usability/calibration review nykyiselle editorille ja projectionille.
- SSP-spesifi cancel/race-stressi ja tuotantokaltainen provider-pilotti.

## Seuraava review-raja

Generic runtime-core ja Configure/Run orchestration UX on toteutettu paikalliseen review-rajaan. Seuraava review rajaa max-bound/cross-host-evidenssin, cancel-race-stressin, human usability/calibrationin ja domain-kalibroidun pilotin.
