---
id: three-level-graph-node-engineering-evidence
title: Kolmitasoisen Graph Node Engineeringin EVIDENCE
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - evidence
---

# Kolmitasoisen Graph Node Engineeringin EVIDENCE

## Evidenssirekisteri

| Evidence ID | QS/requirement | Tarkistus tai havainto | Artefaktit | Tulos | Timestamp/source | Rajoitus |
| --- | --- | --- | --- | --- | --- | --- |
| TGNE-EVID-001 | QS-019 / REQ-015 | Strict-v14 schema ja kaikkien 14 Graph Node Module v4 -pakettien inspect → plan → install → export → remove -roundtrip. | `backend/tests/projectConfigV14.test.ts`, `.ballet/tests/projectLocalGraphNodeLibrary.test.ts` | passed | 2026-08-22, 156-testin local suite | Jokainen paketti läpäisi strict-v4 roundtripin ilman peer-targetia. |
| TGNE-EVID-002 | QS-019 / REQ-015 | Scoped orchestrator dispatch, Work→Validation, retry, repair/escalation, composition ja strict target enum. | `backend/runtime/GraphRoutingEngine.test.ts`, execution/runtime test suites | passed hermetic | 2026-08-22, 156-testin local suite | End-to-end live provider -pilotti ei kuulu paikalliseen suiteen. |
| TGNE-EVID-003 | QS-019 / REQ-015 | SQLite v10, v9 fail-closed, restart/cancel/no-duplicate, tracker resume ja repair frame -evidenssi. | `backend/storage/LocalDatabase.test.ts`, `backend/tracker/TrackerOutbox.test.ts`, runtime persistence tests | passed | 2026-08-22, 156-testin local suite | Testi osoittaa v9-kannan byte-stabiilin fail-closed-käynnistyksen; käyttäjän nykyistä v9-kantaa ei muutettu. |
| TGNE-EVID-004 | QS-020 / REQ-015 | Kolme routea, scope, breadcrumb/back-forward, inspector/Sheet, keyboard/a11y sekä 1440×900/390×844 ja 1/5/40 GraphNode-/1/17/64 JobNode-layoutit. | `frontend/tests/spaceEngineeringCanvas.test.tsx`; `evidence/*.png` | technical/browser passed; human pending | 2026-08-22 in-app Browser + 9 UI-testiä | 19 kuvaa kattaa kolme canonical tasoa, narrow-inspectorin ja kaikki 12 fixture/viewport-yhdistelmää. Selaimessa mitattiin 0 näkyvien node-osien overlapia, 0 page overflow'ta ja 0 konsolivaroitusta/-virhettä. Ihmisen visual verdict vaaditaan erikseen. |
| TGNE-EVID-005 | QS-019 / QS-020 | Arc42, full tests, lint, build, module smoke, DESIGN lint, boundary/legacy search ja diff check. | repository final gate output | passed with 8 non-blocking lint warnings | 2026-08-22 local | 156 testiä; build/arc42/DESIGN/boundary/legacy/diff portit läpäisivät. Varoitukset koskevat tiedostokokoa tai kompleksisuutta, virheitä 0. |

## Diff-to-plan ja conformance

- Strict domain, versions, runtime, module boundary ja canonical UI-routes toteutetaan samassa hard cutissa.
- Historiallisia Goaleja tai ADR:iä ei muokata; `goal-015` ja `adr-023` omistavat uuden hyväksytyn rajan.
- `DESIGN.md` ja `AGENTS.md` päivitetään tekemään kolmesta avaruuscanvasista suojattu visuaalinen sopimus.
- Conformance Validation löysi aktiivisesta instructionista yhden `FailEdge`-legacyviitteen sekä browser-QA kaksi viewport-rajausvikaa: sivutason vaakaylivuodon ja narrow-canvasin väärän lähtöaseman. Kaikki kolme korjattiin, legacy- ja overflow-haut ajettiin uudelleen ja teknisiä priority-1-findingejä jäi 0.

## Avoimet evidenssiaukot

- Projektin omistajan visual verdict tallennetuille desktop/narrow-kuville.
- Ensimmäinen tuotantokaltainen Graph Run, joka mittaa Luna-routerin ja Sol-repairin käytännön laatua/kustannusta.
- Live provider- ja pinnattu tracker-prerequisite eivät korvaudu hermetic testillä.

## Seuraava review-raja

Tekninen REVIEW voidaan viimeistellä TGNE-EVID-001–005:n perusteella. Initiativen acceptance odottaa erillistä projektin omistajan visual verdictiä ja tuotantokaltaisen provider-pilotin päätöstä; kumpikaan ei valtuuta releasea tai muuta ulkoista kirjoitusta.
