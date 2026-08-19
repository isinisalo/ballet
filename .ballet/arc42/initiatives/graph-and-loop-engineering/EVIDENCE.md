---
id: arc42-initiative-graph-and-loop-engineering-evidence
title: Graph and Loop Engineering EVIDENCE
status: draft
createdAt: '2026-08-19'
updatedAt: '2026-08-19'
version: 5
tags:
  - arc42
  - initiative
  - graph-engineering
  - evidence
---

# Graph and Loop Engineering EVIDENCE

## Tila

Strict-v11 domain, schema, project repository, immutable snapshot, Loop module -materialisointi, cross-Loop runtime dispatch sekä authoring-UI:n `graph | loop` hard cut on toteutettu ja testattu. Capabilityt ovat namespaced `accepts`/`provides`-merkkijonoja, Graph omistaa kaikki peer-reitit ja portable package ei saa sisältää Graphia tai peer-targetia. Graph Engineeringin erillinen Orchestrator-control-node ja lopullinen edge-presentation ovat edelleen pending.

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| GLE-EVID-001 | REQ-012 / QS-005 | Päätöspaketin, stable ID:iden, linkkien ja dokumentaation conformance | `goal-012`, `adr-018`, `REQ-012`, `QS-014`, initiative BRIEF/PLAN/EVIDENCE/REVIEW | passed | 2026-08-19 local | Todentaa vain päätös-/dokumentaatiovaiheen; ei strict-v11-toteutusta. |
| GLE-EVID-002 | REQ-012 / QS-014 | Strict-v11 domain/schema/capability hard cut ja v10 rejection | `shared/domain/automation.ts`, `shared/api/workspace-schemas.ts`, `backend/project-config/ProjectConfigurationRepository.ts`, `.ballet/project.json` | passed | 2026-08-19 local tests | Todentaa data/config/API-sopimuksen; ei cross-Loop-dispatchia tai authoring-routeja. |
| GLE-EVID-003 | REQ-012 / QS-014 | Snapshot/repository/module v11 -closure ja recovery | Root Execution Snapshot v4, `backend/runs/`, `backend/runtime/RootExecutionSnapshotSchema.ts`, `backend/loop-modules/` | passed | 2026-08-19 local tests | Snapshot tallentuu nykyiseen SQLite JSON-kenttään; uusi SQLite-schema migration ei ollut tarpeen. Dispatch-semantics ei muuttunut. |
| GLE-EVID-004 | REQ-012 / QS-003, QS-014 | Flow/repair Orchestrator-dispatch, call frame, ambiguity ja permission boundary | SQLite schema v7; Task Envelope V4; `LoopOrchestrator`, `OrchestrationStore`, `LoopCompletionEngine`; runtime/integration tests | passed | 2026-08-19 local tests | Todentaa runtime- ja persistence-rajan; Graph/Loop-authoring-UI ja ihmisacceptance eivät kuulu tähän osaevidenssiin. |
| GLE-EVID-005 | REQ-012 / QS-014 | Context/numeric routing -legacy removal ja `graph | loop` hard cut | frontend route union/parser/generators, `EngineeringShell`, Context-tiedostojen poisto | passed | 2026-08-19 local tests/search | Todentaa routing- ja information-architecture-rajan; Graphin control-node ei kuulu tähän osaevidenssiin. |
| GLE-EVID-006 | REQ-007, REQ-012 / QS-013, QS-014 | Graph Engineering projection/UI/visual/accessibility | `GraphEngineeringWorkspace`, `GraphEngineeringCanvas`, `engineeringProjections` | partial | 2026-08-19 local tests | LoopNode/project-global graph, inspector, keyboard ja narrow Sheet on toteutettu; erillinen Orchestrator-control-node ja lopullinen edge-presentation ovat pending. |
| GLE-EVID-007 | REQ-011, REQ-012 / QS-010, QS-014 | Loop Engineering selected-Loop-only regressiosuoja | `LoopEditor`, `LoopCanvas`, routing/deep-link/module handoff | passed | 2026-08-19 local tests | Todentaa selected-Loop-only Work/Validation-editorin, active Run -lukituksen ja URL-owned näkymän; ei Graph-control-nodea. |
| GLE-EVID-008 | REQ-010, REQ-012 / QS-009, QS-014 | Project-local Loop Libraryn v11 capability- ja peer-target-riippumattomuus | `.ballet/loop-library/**`, `shared/api/loop-module-schemas.ts`, `backend/loop-modules/LoopModuleService.ts` | passed | 2026-08-19 local package/install/export/API/release checks | Todentaa package/materialisointirajan; Graph/Loop-authoring-UI:n lopullinen module handoff kuuluu myöhempään UI-vaiheeseen. |
| GLE-EVID-009 | REQ-012 / QS-014 | Täysi verification-, conformance- ja ihmisacceptance | GLE-step-008 / TEST-014 / EVID-014 | pending | future implementation | Ei accepted REVIEW'ta eikä external-write-valtuutusta. |

## Muutos- ja päätösevidenssi

- Käyttäjän 2026-08-19 toimeksianto käsittelee `goal-012`:n listatut WHAT/WHY-päätökset hyväksyttyinä ja valtuuttaa `adr-018`:n accepted-päätöspaketin.
- Strict-v11 tuotantokoodi ja testit osoittavat Graph/capability-datan, immutable snapshotin, target-riippumattoman package/materialisointirajan sekä persisted Orchestration Request/route/dispatch -polun. Automaattinen `followFlow` on poistettu; flow ja repair kulkevat saman generic Orchestrator-rajan kautta, mutta vain repair luo framen ja palaa samaan Validationiin. Frontend hyväksyy vain Graph Engineering / Loop Engineering -mallin ja näyttää eksplisiittisen virheen invalidista `view`-arvosta tai puuttuvasta Loop-ID:stä.
- Historialliset `goal-011`, `adr-015`, `adr-017` ja `loop-engineer-three-level-canvas` säilyvät muuttumattomina evidenssilähteinä.

## Vaiheen tarkistukset

### GLE-step-004/006 frontend information architecture

- `npm run test -- frontend/tests/routing.test.ts frontend/tests/loopEngineerProjections.test.ts` — lähtöbaseline passed: 2 tiedostoa, 11 testiä ennen hard cutia.
- `npm run test -- frontend/tests/routing.test.ts frontend/tests/engineeringProjections.test.ts` — hard cutin jälkeen passed: 2 tiedostoa, 9 testiä. Mukana vain `graph | loop`, paljas Graph-default, invalid/legacy-routejen eksplisiittinen rejection, deterministic Graph-projektio ja selected-Loop-only Loop-projektio.
- `npm run test -- frontend/tests/engineeringUi.test.tsx frontend/tests/workLoopEditorUi.test.tsx frontend/tests/workLoopProjection.test.ts frontend/tests/workspaceNavigation.test.tsx frontend/tests/balletModeUi.test.tsx frontend/tests/loopThemeEditorUi.test.tsx frontend/tests/loopLibraryUi.test.tsx` — ensimmäinen ajo löysi narrow-testin `matchMedia`-spy cleanup -virheen (3 testiä failed ennen assertionia); korjauksen jälkeinen sama komento passed: 7 tiedostoa, 39 testiä.
- `npm run test` — passed: 89 tiedostoa + 1 skipped; 461 testiä + 2 skipped.
- `npm run lint` — passed: 0 erroria ja tunnettu 14 warningin baseline; muutos ei kasvattanut warningeja.
- `npm run build` — passed: TypeScript build ja Vite production bundle, 2627 modulea transformed.
- `npm run validate:arc42` — passed: 12 sections, 48 unique document IDs, 8 Loops ja 35 Loop Edges.
- `npx @google/design.md lint DESIGN.md` — passed: 0 errors, 0 warnings ja 1 token-summary info.
- `git diff --check` — passed ilman outputia ennen final-evidenssipäivitystä; tarkistus ajetaan uudelleen lopulliselle diffille.
- Rajattu tuotantokoodihaku `LoopEngineerLevel|automationContextPath|automationCompositionPath|LoopContext|level=context|level=1|level=2|view=all|Level 0|Level 1|Level 2` — 0 osumaa frontendin tuotantokoodissa. Rejection-testit säilyttävät legacy-URL-merkkijonot testidatana.
- Poistetut legacy-tiedostot: `LoopContextCanvas.tsx`, `LoopEngineerShell.tsx`, `LoopCompositionWorkspace.tsx`, `LoopCompositionCanvas.tsx`, `loopCompositionLayout.ts` ja `loopEngineerProjections.ts`; aktiiviset vastuut ovat `EngineeringShell.tsx`, `GraphEngineeringWorkspace.tsx`, `GraphEngineeringCanvas.tsx`, `graphEngineeringLayout.ts` ja `engineeringProjections.ts`.

### GLE-step-003 runtime orchestration

- `npm run test -- backend/runtime/LoopOrchestrator.test.ts backend/runtime/LoopOrchestratorRecovery.test.ts backend/runtime/WorkLoopEngine.test.ts` — alkuperäinen baseline passed 3 tiedostoa / 34 testiä; toteutuksen kaksi ensimmäistä uusinta-ajoa paljasti vanhat `repairInput`/Task Envelope -fixturet ja capability-mismatchin, korjausten jälkeinen sama komento passed 3/34.
- `npm run test -- backend/runtime/LoopOrchestratorFlow.test.ts backend/runtime/LoopOrchestrator.test.ts backend/runtime/LoopOrchestratorRecovery.test.ts backend/runtime/WorkLoopEngine.test.ts backend/runtime/RuntimeStores.test.ts backend/integration/TaskEnvelopeV4.test.ts backend/execution/ExecutionComposition.test.ts backend/execution/NodeOutcomeContract.test.ts` — passed: 8 tiedostoa, 89 testiä. Mukana zero/one/many flow, exact Root Run completion, ambiguity, allowlist/kind/capability/source fail-closed, bounded dispatch, permission boundary, repair return ja restart-idempotenssi.
- `npm run test` — passed: 89 tiedostoa + 1 skipped; 460 testiä + 2 skipped.
- `npm run lint` — passed: 0 erroria ja tunnettu 14 warningin baseline; runtime-muutos ei kasvattanut baselinea.
- `npm run build` — passed: TypeScript build ja Vite production bundle, 2628 modulea transformed.
- `npx tsc -b --pretty false` — passed ilman outputia viimeisen source-muutoksen jälkeen.
- `npm run validate:arc42` — passed: 12 sections, 48 unique document IDs, 8 Loops ja 35 Loop Edges.
- Platform/project-boundary-haku — passed ilman project-workflow-osumia `backend`, `frontend` tai `shared` -hakemistoissa.
- `rg -n 'followFlow|TaskEnvelopeV3|allowedTargetLoops|repairInput' backend frontend shared` — 0 osumaa.
- Target-selection-haku config-/Loop-/Validation-rajalta — tuotantodomainissa, workspace-skeemassa ja project configissa 0 `targetLoopId`-osumaa; vain generic Orchestrator-instruction nimeää providerin sallitun target-ehdotuksen.
- Frontend UI -tiedostoja ei muutettu; shared runtime read contractiin lisättiin vain canonical orchestration-projektio.

### Aiempi data/snapshot/module-osavaihe

- `npm run validate:arc42` — passed: 12 sections, 48 unique document IDs, 8 Loops ja 35 Loop Edges.
- `npx @google/design.md lint DESIGN.md` — passed: 0 errors, 0 warnings ja 1 token-summary info.
- `git diff --check` — passed ilman outputia.
- `npx vitest run backend/tests/projectConfigV11.test.ts backend/tests/projectConfigurationRepository.test.ts backend/runs/LoopExecutionSnapshot.test.ts backend/tests/loopModules.test.ts` — passed: 4 tiedostoa, 41 testiä.
- `npx vitest run backend/tests/loopModules.test.ts backend/tests/loopModuleHttp.test.ts frontend/tests/loopLibraryUi.test.tsx frontend/tests/loopEngineerUi.test.tsx` — passed: package/install/export/API/UI-smoke, 4 tiedostoa ja 28 testiä.
- `npm run test` — passed: 88 tiedostoa + 1 skipped; 449 testiä + 2 skipped.
- `npm run lint` — passed: 0 erroria ja tunnettu 14 warningin baseline; v11-muutos ei lisännyt warningeja.
- `npm run build` — passed: TypeScript build ja Vite production bundle.
- `sh scripts/build-release.sh 0.1.0-test arm64 /tmp/ballet-release-v11-0.1.0-test` — passed: packaged server, strict-v11 fixture config, fixture Loop Library capabilityt, API, SQLite, clean Git ja graceful shutdown; archive SHA-256 `f6a783da94113a340a97e15f9e617e2718120e132122a13a89eed7eaac9ef616`.
- Platform/project-boundary-haku — passed ilman osumia `backend`, `frontend` tai `shared` -hakemistoissa.
- Rajatut config/repository/snapshot/module-testit sekä koko testimatriisi todentavat v11-shapen. Frontend-muutokset ovat mekaanista `graph.loopEdges`-data-shape-plumbingia; näkymiä, routeja tai käyttäytymistä ei muutettu.

Ensimmäinen argumentiton `npm run release:build` pysähtyi odotetusti usage-koodiin 2. Ensimmäinen argumentoitu release-smoke löysi fixture-paketista vanhan capability-muodon ja `nextLoopId`:n; fixture korjattiin, v11-assertiot lisättiin ja yllä dokumentoitu uusinta-ajo läpäisi.

## Avoimet evidenssivajeet

GLE-EVID-006:n Orchestrator-control-node/lopullinen edge-presentation ja GLE-EVID-009:n täysi conformance/ihmisacceptance ovat blocking-pending ennen koko v11-implementation acceptancea. GLE-EVID-005 ja GLE-EVID-007 todistavat routing- sekä selected-Loop-rajat, eivät Graph-visualisoinnin viimeistä vaihetta.

## Seuraava review basis

Tämä rajattu vaihe voidaan katselmoida, kun GLE-EVID-002/003/008 sisältävät tarkat komennot ja tulokset. Koko implementation-REVIEW ei valmistu ennen kuin PLANin kaikki priority-1 -tarkistukset ovat ajettu tai niiden blocker on eksplisiittisesti päätetty.
