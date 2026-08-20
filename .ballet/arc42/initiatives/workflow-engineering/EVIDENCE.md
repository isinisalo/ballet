---
id: workflow-engineering-evidence
title: Workflow Engineering hard cut evidence
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-20'
version: 2
tags:
  - arc42
  - initiative
  - workflow-engineering
  - evidence
---

# Workflow Engineering EVIDENCE

## Evidence records

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| WFE-EVID-001 | REQ-013 / QS-015 | Strict v12/v2 domain, pairing, edge cardinality, endpoint, reachability and legacy version rejection | `shared/domain`, `shared/api`, config/module tests | passed | 2026-08-20 local test suites | No compatibility reader is exercised. |
| WFE-EVID-002 | REQ-013 / QS-003, QS-015 | Job→Validation, PASS→Job/PASS, bounded retry and fourth FAIL escalation | `backend/runtime`, Workflow engine tests | passed | 2026-08-20 full suite: 463 passed, 2 skipped | No operative long-running pilot. |
| WFE-EVID-003 | REQ-013 / QS-003, QS-015 | Orchestrator allowlist/capability, same-Validation repair return, no Job rerun/retry reset, limits and LIFO | runtime/orchestrator tests | passed | 2026-08-20 backend suite | Operative long-running pilot not performed. |
| WFE-EVID-004 | REQ-013 / QS-012, QS-015 | SQLite v8 `job_runs`, transaction, v7 fail-closed, restart/cancel/recovery | storage/runtime/run tests | passed | 2026-08-20 backend suite | Existing user database was not mutated. |
| WFE-EVID-005 | REQ-013 / QS-013, QS-015 | Atomic pair create/delete, separate editors/edges, canonical routes, keyboard and deterministic canvas | frontend suites plus desktop/narrow browser screenshots | passed | 2026-08-20; 1440×900 and 390×844 local browser QA | Browser QA found and verified the Enter/Space activation fix; human visual verdict remains pending. |
| WFE-EVID-006 | REQ-013 / QS-009, QS-015 | V2 package generation, install/export/API/UI, project-local materialization and packaged release smoke | Loop Library packages, module suites and `build-release.sh` | passed | 2026-08-20: 45 module tests; darwin-arm64 archive SHA-256 `4fe56aa5bca60c7cf4c2021f52435cdf3e46942e5a10c375b89528a187970dcd` | Local unsigned smoke only; no release was published. |
| WFE-EVID-007 | REQ-013 / QS-005, QS-015 | Canonical docs, boundary/legacy search, arc42/test/lint/build/design/diff gates | repository commands and this initiative | passed | 2026-08-20: arc42 52 IDs/11 Loops/20 Jobs/62 Loop Edges; tests 463+2 skipped; lint 0 errors/14 baseline warnings; build and diff check passed; design lint 0 errors/warnings; boundary and active legacy searches 0 hits | Local evidence only; no external release or write was performed. |
| WFE-EVID-008 | REQ-013 / QS-015 | Desktop and narrow visual QA with icon/text/color and cycle readability | Workflow Engineering UI | pending | project owner | Human acceptance required. |
| WFE-EVID-009 | REQ-013 / QS-015 | ADR-021 Job-only canvas: paired Validation inside Job, no result nodes or validate/retry paths, only persisted straight/smart-smoothstep Edges, protected space theme | `workflowCanvasUi.test.tsx`, full suite, lint/build/design/arc42/diff gates and new desktop/narrow browser screenshots | passed | 2026-08-20: 1440×900 and 390×844 browser QA; 464 tests passed, 2 skipped; 0 lint errors / 14 baseline warnings | Local technical and visual-structure evidence; WFE-EVID-008 human verdict remains pending. |

Browser artifacts:

- Pre-ADR-021 separate-node evidence (historical):
- `/Users/iiro.sinisalo/.codex/visualizations/2026/08/20/01a01f70-af49-7aa3-a94f-5c430a99b7ae/workflow-engineering-desktop.png`
- `/Users/iiro.sinisalo/.codex/visualizations/2026/08/20/01a01f70-af49-7aa3-a94f-5c430a99b7ae/workflow-engineering-narrow.png`
- ADR-021 corrected Job-only canvas:
- `/Users/iiro.sinisalo/.codex/visualizations/2026/08/20/01a01f70-af49-7aa3-a94f-5c430a99b7ae/workflow-job-only-desktop.png`
- `/Users/iiro.sinisalo/.codex/visualizations/2026/08/20/01a01f70-af49-7aa3-a94f-5c430a99b7ae/workflow-job-only-narrow.png`

## Changed surfaces

Shared domain/API, backend runtime/storage/runs/scheduling/module boundaries, frontend Graph/Workflow authoring and Run projections, repository project/Loop Library/instruction data, tests, Goals/ADR/arc42 and `DESIGN.md`.

## Conformance findings

- Graph Engineering, State, Orchestrator allowlist, Loop Module materialization and project/platform boundaries remain structurally in place.
- Fixed Job→Validation and retry transitions are runtime invariants rather than a third authorable Edge kind.
- ADR-021 supersedes only the earlier separate-node canvas projection; WFE-EVID-005 remains historical evidence of the pre-correction implementation and WFE-EVID-009 evaluates the corrected projection.
- V7 database handling is fail-closed; no destructive migration was run.

## Open questions

- WFE-EVID-008 blocks final initiative acceptance until the project owner records a visual verdict. WFE-EVID-009 has passed.

## Next review basis

Obtain WFE-EVID-008 before accepting REVIEW; do not infer a human verdict from technical browser evidence.
