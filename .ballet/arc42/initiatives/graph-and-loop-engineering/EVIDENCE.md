---
id: arc42-initiative-graph-and-loop-engineering-evidence
title: Graph and Loop Engineering EVIDENCE
status: draft
createdAt: '2026-08-19'
updatedAt: '2026-08-19'
version: 3
tags:
  - arc42
  - initiative
  - graph-engineering
  - evidence
---

# Graph and Loop Engineering EVIDENCE

## Tila

Strict-v11 domain, schema, project repository, immutable snapshot ja Loop module -materialisointi on toteutettu ja testattu. Capabilityt ovat namespaced `accepts`/`provides`-merkkijonoja, Graph omistaa kaikki peer-reitit ja portable package ei saa sisältää Graphia tai peer-targetia. Cross-Loop-dispatch ja authoring-UI:n Graph/Loop hard cut eivät kuulu tähän vaiheeseen ja ovat edelleen pending.

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| GLE-EVID-001 | REQ-012 / QS-005 | Päätöspaketin, stable ID:iden, linkkien ja dokumentaation conformance | `goal-012`, `adr-018`, `REQ-012`, `QS-014`, initiative BRIEF/PLAN/EVIDENCE/REVIEW | passed | 2026-08-19 local | Todentaa vain päätös-/dokumentaatiovaiheen; ei strict-v11-toteutusta. |
| GLE-EVID-002 | REQ-012 / QS-014 | Strict-v11 domain/schema/capability hard cut ja v10 rejection | `shared/domain/automation.ts`, `shared/api/workspace-schemas.ts`, `backend/project-config/ProjectConfigurationRepository.ts`, `.ballet/project.json` | passed | 2026-08-19 local tests | Todentaa data/config/API-sopimuksen; ei cross-Loop-dispatchia tai authoring-routeja. |
| GLE-EVID-003 | REQ-012 / QS-014 | Snapshot/repository/module v11 -closure ja recovery | Root Execution Snapshot v4, `backend/runs/`, `backend/runtime/RootExecutionSnapshotSchema.ts`, `backend/loop-modules/` | passed | 2026-08-19 local tests | Snapshot tallentuu nykyiseen SQLite JSON-kenttään; uusi SQLite-schema migration ei ollut tarpeen. Dispatch-semantics ei muuttunut. |
| GLE-EVID-004 | REQ-012 / QS-003, QS-014 | Flow/repair Orchestrator-dispatch, call frame, ambiguity ja permission boundary | GLE-step-003 | pending | future implementation | Nykyinen v10 repair-evidenssi ei todista v11 flow-dispatchia. |
| GLE-EVID-005 | REQ-012 / QS-014 | Context/numeric routing -legacy removal ja `graph | loop` hard cut | GLE-step-004 | pending | future implementation | Nykyinen UI toteuttaa yhä Context / Level 1 / Level 2 -reitit. |
| GLE-EVID-006 | REQ-007, REQ-012 / QS-013, QS-014 | Graph Engineering projection/UI/visual/accessibility | GLE-step-005 | pending | future implementation | Graph UI:ta tai Orchestrator-control-nodea ei ole toteutettu. |
| GLE-EVID-007 | REQ-011, REQ-012 / QS-010, QS-014 | Loop Engineering selected-Loop-only regressiosuoja | GLE-step-006 | pending | future implementation | Nykyinen Level 2 -evidenssi on baseline, ei v11 acceptance. |
| GLE-EVID-008 | REQ-010, REQ-012 / QS-009, QS-014 | Project-local Loop Libraryn v11 capability- ja peer-target-riippumattomuus | `.ballet/loop-library/**`, `shared/api/loop-module-schemas.ts`, `backend/loop-modules/LoopModuleService.ts` | passed | 2026-08-19 local package/install/export/API/release checks | Todentaa package/materialisointirajan; Graph/Loop-authoring-UI:n lopullinen module handoff kuuluu myöhempään UI-vaiheeseen. |
| GLE-EVID-009 | REQ-012 / QS-014 | Täysi verification-, conformance- ja ihmisacceptance | GLE-step-008 / TEST-014 / EVID-014 | pending | future implementation | Ei accepted REVIEW'ta eikä external-write-valtuutusta. |

## Muutos- ja päätösevidenssi

- Käyttäjän 2026-08-19 toimeksianto käsittelee `goal-012`:n listatut WHAT/WHY-päätökset hyväksyttyinä ja valtuuttaa `adr-018`:n accepted-päätöspaketin.
- Strict-v11 tuotantokoodi ja testit osoittavat Graph/capability-datan, immutable snapshotin ja target-riippumattoman package/materialisointirajan. Nykyiset Context/composition/detail-reitit, repair call/return ja automaattinen `followFlow` säilyivät tarkoituksella muuttumattomina.
- Historialliset `goal-011`, `adr-015`, `adr-017` ja `loop-engineer-three-level-canvas` säilyvät muuttumattomina evidenssilähteinä.

## Vaiheen tarkistukset

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

GLE-EVID-004–007 ja GLE-EVID-009 ovat blocking-pending ennen koko v11-implementation acceptancea. GLE-EVID-002/003/008 eivät todista dispatchia tai authoring-UI:ta.

## Seuraava review basis

Tämä rajattu vaihe voidaan katselmoida, kun GLE-EVID-002/003/008 sisältävät tarkat komennot ja tulokset. Koko implementation-REVIEW ei valmistu ennen kuin PLANin kaikki priority-1 -tarkistukset ovat ajettu tai niiden blocker on eksplisiittisesti päätetty.
