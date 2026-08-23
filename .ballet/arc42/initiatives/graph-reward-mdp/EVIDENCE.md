---
id: graph-reward-mdp-evidence
title: Graph Reward-MDP initiative evidence
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 3
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
| GRM-evid-004 | QS-005, QS-009, QS-026 | Arc42-, full test-, lint-, build-, DESIGN-, Module v6-, boundary-, diff-, package/install- ja startup-portit. | TEST-026 | passed | `validate:arc42`: 12/84/5/17/114; test: 47 files ja 166 testiä; lint: 0 varoitusta; DESIGN: 0 error/0 warning; Module v6: 3/3 ja 14 pakettia; `git diff --check`: clean; `make latest`: checksum `3e9f258affebc6bd2d2080b028cd9e2568ffbcd5f9c8546c6447a80d299bf4d6`; installed health: v0.1.0 portissa 53321; SQLite metadata: v14. |
| GRM-evid-005 | QS-026 | Tuotantokaltainen viiden GraphNoden pilotti. | myöhempi Root Run ID | pending | Mitään pilotin tulosta ei väitetä. |
| GRM-evid-006 | QS-024, QS-026 | ADR-032:n visual impact -dashboardin focused frontend-testit ja production-buildin 1440×900/390×844-selain-QA verrattuna aiempaan Reward-MDP-pintaan. | `frontend/tests/decisionModelWorkspace.test.tsx`; `output/playwright/reward-mdp-{desktop,narrow}.png`; `output/playwright/reward-impact-{desktop,desktop-details,narrow,narrow-details}.png` | passed | Decision pulse, configured-order horizon, punainen `−/cost`, vihreä `+/reward`, relative V -heatmap ja human-unit-stepperit näkyvät; transition-mallittoman GraphNoden tila on testattu. Molemmissa viewporteissa page/body overflow 0, clipped heading 0, primary form/table 0 ja console error/warning 0. Final project-owner pixel verdict pending. |

## Päätökset

`goal-020`, `adr-031`, `adr-032`, `CON-013`, `BB-013`, `RT-020`. Transientteja komentolokeja ei kopioida tähän. Tekninen cut on valmis; operational acceptance pysyy erillään GRM-evid-005:n tuotantokaltaisessa pilotissa.
