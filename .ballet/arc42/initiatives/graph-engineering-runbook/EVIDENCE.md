---
id: graph-engineering-runbook-evidence
title: Graph Engineering RunBook initiative evidence
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-21'
version: 2
tags:
  - arc42
  - initiative
  - graph-engineering
  - evidence
---

# Graph Engineering RunBook EVIDENCE

## Tarkoitus ja tila

Tämä indeksoi `goal-014` / `QS-016`–`QS-018` -acceptance-evidenssin kopioimatta runtime-lokeja. Tekninen toteutus, hermetic tracker -matriisi ja selaimen regressio-QA on ajettu; oikean pinnatun `tk`:n smoke sekä projektin omistajan visual verdict pysyvät erillisinä avoimina evidensseinä.

## Evidenssirivit

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| GER-EVID-001 | REQ-014 / QS-016 | Strict schema-, snapshot-, runtime- ja 18-transition-matriisi | shared/backend tests; RT-012; TEST-016 | passed | 2026-08-21 `npm test`: 92 files passed, 1 skipped; 495 tests passed, 2 skipped | Paikallinen automatisoitu evidenssi; ensimmäinen tuotantokaltainen Graph Run on erillinen pilotti. |
| GER-EVID-002 | REQ-014 / QS-018 | Hermetic `tk` preflight/outbox/reconciliation/fault matrix | `backend/tracker/`; RT-013; TEST-018 | passed (hermetic) | 2026-08-21 full test suite | Fake CLI kattaa fail-closed- ja idempotenssimatriisin, mutta ei korvaa live-smokea. |
| GER-EVID-003 | REQ-014 / QS-016, QS-018 | Viiden Loopin config, 12 DESIGN Jobia, 18 transitionia, release map ja platform-boundary | `.ballet/project.json`, `.ballet/releases/`, `.ballet/instructions/` | passed | 2026-08-21 `validate:arc42`: 12 sections, 56 IDs, 5 Loops, 17 Jobs, 18 transitions; boundary search 0 osumaa | Repository-data on project-local; runtime ei kovakoodaa viiden Loopin nimiä. |
| GER-EVID-004 | REQ-010, REQ-014 / QS-009, QS-016 | V3 package/install/export/API/UI/release smoke | `.ballet/loop-library/graph-engineering/`, module suites | passed | 2026-08-21 module suite: 4 files / 22 tests; final packaged release smoke passed, SHA-256 `419596d6065d078705f0889098e8ee0bc0debe147b5c1b4faf77b640b153762f` | Smoke ei julkaissut, asentanut pysyvästi eikä tehnyt ulkoista kirjoitusta; recommended routes ovat advisory-dataa. |
| GER-EVID-005 | REQ-007, REQ-014 / QS-017 | Graph 1/5/40 desktop/narrow ja Workflow regression QA | frontend tests; `output/playwright/graph-engineering-runbook-*.png`; `output/playwright/workflow-engineering-design-regression-*.png` | passed (technical) | 2026-08-21 21 UI/layout-testiä ja selaimen 1440×900 / 390×844 QA | 0 page overflow'ta, 5 Loopia + DONE työpöydällä, 12 Workflow Job-artworkia; projektin omistajan visual verdict on erillinen. |
| GER-EVID-006 | REQ-009, REQ-014 / QS-005, QS-016–QS-018 | Full repository gates, docs, boundary search ja diff check | npm/design/git checks | passed | 2026-08-21: tests 495 passed, lint 0 errors / 14 baseline warnings, build passed, arc42 passed, DESIGN lint 0 errors/warnings, boundary 0, `git diff --check` passed | Ei deploy-, release-, merge- tai push-toimintoa. |
| GER-EVID-007 | REQ-014 / QS-018 | Pinned real `tk` smoke | h2oai/tk `d778bb520ee526c314c26f2bb876447e0a19caa5` | pending | 2026-08-21 `command -v tk`: ei tulosta | Prerequisite ei ole asennettuna; ympäristöä ei muutettu eikä hermetic evidenssiä esitetä live-smokena. |

## Kanoniset lähteet

Ajettujen komentojen tulokset, reviewattu diffi, nimetyt screenshotit ja runtime/test fixturet. Täydet transientit logit säilyvät niiden omissa järjestelmissä.

## Relevantit päätökset

`adr-007`, `adr-015`, `adr-016`, `adr-020`, `adr-021`, `adr-022`, `CON-005`, `CON-007`, `CON-009`, `CON-010`.

## Avoimet kysymykset

Live `tk`-smoken saatavuus, ensimmäinen tuotantokaltainen Graph Run ja projektin omistajan Graph/Workflow visual verdict pysyvät eksplisiittisinä eivätkä estä muiden rivien täsmällistä statusta.

## Seuraava katselmointiperuste

Päivitä REVIEW, kun projektin omistaja antaa visual verdictin, pinnattu `tk` tulee saataville live-smokeen tai ensimmäinen tuotantokaltainen Graph Run tuottaa uutta evidenssiä.
