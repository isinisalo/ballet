---
id: graph-reward-mdp-evidence
title: Graph Reward-MDP initiative evidence
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arc42
  - initiative
  - evidence
---

# Graph Reward-MDP EVIDENCE

| Evidence ID | QS/requirement | Tarkistus | Artifactit | Tulos | Rajoitus |
| --- | --- | --- | --- | --- | --- |
| GRM-evid-001 | REQ-020, QS-026 | Strict contract-, platform-boundary- ja legacy-absence-katselmointi. | `shared/`, `backend/`, `frontend/`, active project data | passed | Production/project-haut: 0 agent/SSP/local-policy/Repair/routing-persistence/JobNode-osumaa; historialliset audit-artefaktit säilyvät. |
| GRM-evid-002 | QS-026 | Compiler-, ledger-, factual realized-reward-, authorization-, transition-limit-, persistence- ja hermetic runtime -testit. | `backend/policy/*Reward*`, `backend/runtime/Runtime*` | passed | Ei tuotantokaltainen pilotti. |
| GRM-evid-003 | QS-020, QS-024, QS-026 | Asennetun release-paketin desktop 1440×900- ja narrow 390×844 -QA: Reward‑MDP, ordered Action flow, sivuylivuoto ja browser console. | `output/playwright/reward-mdp-*.png`, `output/playwright/action-flow-*.png` | passed | Löydetty narrow-otsikon leikkaus korjattiin; final mittaus: page overflow 0, clipped heading/action 0, console error/warning 0. Ihmisen project-owner-verdictiä ei väitetä. |
| GRM-evid-004 | QS-005, QS-009, QS-026 | Arc42-, full test-, lint-, build-, DESIGN-, Module v6-, boundary-, diff-, package/install- ja startup-portit. | TEST-026 | passed | `validate:arc42`: 12/84/5/17/114; test: 47 files ja 165 testiä; lint: 0 varoitusta; DESIGN: 0 error/0 warning; Module v6: 3/3 ja 14 pakettia; `git diff --check`: clean; `make latest`: checksum `944f1e8a3ddf8e8acb4eb298f4337134c13106c767eaf1accde4921cb0d77239`; health: v0.1.0; SQLite metadata: v14. |
| GRM-evid-005 | QS-026 | Tuotantokaltainen viiden GraphNoden pilotti. | myöhempi Root Run ID | pending | Mitään pilotin tulosta ei väitetä. |

## Päätökset

`goal-020`, `adr-031`, `CON-013`, `BB-013`, `RT-020`. Transientteja komentolokeja ei kopioida tähän. Tekninen cut on valmis; operational acceptance pysyy erillään GRM-evid-005:n tuotantokaltaisessa pilotissa.
