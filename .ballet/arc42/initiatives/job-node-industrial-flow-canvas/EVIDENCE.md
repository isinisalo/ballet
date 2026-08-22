---
id: arc42-initiative-job-node-industrial-flow-canvas-evidence
title: Job Node industrial flow canvas EVIDENCE
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 2
tags:
  - arc42
  - initiative
  - evidence
---

# Job Node industrial flow canvas EVIDENCE

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| JNIFC-EVID-001 | QS-020 / REQ-015 | Pure wide/narrow layout, structural Work/Validation ghost state, exact orchestrator ID and `maxRetries=0/N` matrix. | `frontend/tests/jobFlowProjection.test.ts`; `frontend/src/workspace/automation/jobFlowProjection.ts` | passed | `npm run test`, 2026-08-22: 42 files / 164 tests passed | Hermetic projection evidence; human visual judgement is not inferred. |
| JNIFC-EVID-002 | QS-020 / REQ-015 | Exact flow semantics, only two interactive nodes, keyboard/a11y selection, desktop inspector, narrow Sheet and active Run authoring lock. | `frontend/tests/spaceEngineeringCanvas.test.tsx`; `frontend/tests/automationViewJobFlow.test.tsx`; `frontend/src/workspace/automation/JobFlowCanvas.tsx` | passed | `npm run test`, 2026-08-22: 42 files / 164 tests passed | Active Run locking is component/integration evidence, not a live Run mutation. |
| JNIFC-EVID-003 | QS-020 / REQ-015 | ADR-025, DESIGN/AGENTS and arc42 trace conformance; no backend/runtime/persistence/module/candidate change; all extracted frontend modules are below 150 lines. | `adr-025`; BB-001; CON-005/011; QS/TEST/EVID-020; `JobFlowCanvas.tsx` 86 lines; `jobFlowProjection.ts` 79 lines; `automationSelection.ts` 120 lines | passed | conformance review plus `npm run lint`, `npm run build`, `npm run validate:arc42`, `npx @google/design.md lint DESIGN.md`, 2026-08-22 | Lint has 0 errors and 8 pre-existing size/complexity warnings; `AutomationView` remains one of the warnings. |
| JNIFC-EVID-004 | QS-020 / REQ-015 | 1440×900/390×844 before/after and inspector/Sheet QA: node overlap 0, page horizontal overflow 0, clipped core action 0, console error 0, two canvas buttons, disabled Next job and reduced-motion rule present. Installed lifecycle and UI smoke also passed. | `evidence/before-job-node-canvas-1440x900.png`; `evidence/before-job-node-canvas-390x844.png`; `evidence/job-node-flow-1440x900.png`; `evidence/job-node-flow-390x844.png`; `evidence/job-node-flow-work-inspector-1440x900.png`; `evidence/job-node-flow-work-sheet-390x844.png`; `evidence/job-node-flow-validation-sheet-390x844.png` | passed | in-app browser QA plus `make latest`, `ballet --no-open`, `ballet status`, 2026-08-22 | Browser QA proves the requested technical viewport criteria; project-owner visual verdict remains separate. |

## Avoimet kysymykset

Tekninen implementation-, conformance-, browser- ja installed-app-evidenssi on passed. Ihmisen visual verdict jää pendingiksi eikä tekninen tulos valtuuta releasea, deployta, mergeä tai pushia.

## Seuraava katselmointiperuste

Ready for project-owner visual REVIEW against the stored 1440×900 and 390×844 before/after artifacts.
