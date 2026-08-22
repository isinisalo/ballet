---
id: arc42-initiative-job-node-industrial-flow-canvas-plan
title: Job Node industrial flow canvas PLAN
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - plan
---

# Job Node industrial flow canvas PLAN

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| jnifc-step-001 | goal-015 / REQ-015 | QS-020 | adr-025 / CON-005 | BB-001 | DEP-001 | pure Job flow projection and shared Work/Validation schema exports | projection unit tests | JNIFC-EVID-001 |
| jnifc-step-002 | goal-015 / REQ-015 | QS-020 | adr-025 / CON-005 / CON-011 | BB-001 | RT-014 | Job flow renderer, selection, inspector/Sheet and token CSS | component/integration tests | JNIFC-EVID-002 |
| jnifc-step-003 | goal-015 / REQ-015 | QS-020 | adr-025 / CON-005 | BB-001 / BB-008 | DESIGN, AGENTS, ADR and arc42 trace | arc42/design/conformance checks | JNIFC-EVID-003 |
| jnifc-step-004 | goal-015 / REQ-015 | QS-020 | adr-025 / CON-005 | BB-001 / BB-002 | desktop/narrow browser, full gates and installed app smoke | browser QA + build/install/status | JNIFC-EVID-004 |

## Järjestys ja yhteensopivuus

Pure projection precedes rendering; interaction tests precede browser QA; documentation and ADR conformance precede final evidence. Muutos on wire-compatible: config v14, Module v4 ja runtime-versiot säilyvät eikä migrationia ole.

## Riskit ja rollback

Riskit ovat narrow-layout overflow, staattisen placeholderin tulkinta tallennetuksi targetiksi sekä appearance-kenttien muuttuminen näkymättömiksi. Ne rajataan exact aria-disabled/microcopyllä, responsive layoutilla, emblem/size-projektiolla ja screenshot-evidenssillä. Rollback on frontend-projektion palautus; project/runtime-dataa ei tarvitse muuntaa.

## Tarkistukset

`npm run test`, `npm run lint`, `npm run build`, `npm run validate:arc42`, `npx @google/design.md lint DESIGN.md`, `git diff --check`, 1440×900/390×844 browser-QA, `make latest`, `ballet --no-open` ja `ballet status`.

## Avoimet kysymykset

Ei implementation-blockeria. Human visual verdict jää erilliseksi acceptance-toimeksi; suunnitelma ei valtuuta external writea.
