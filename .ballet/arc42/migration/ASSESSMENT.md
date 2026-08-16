---
id: arc42-migration-assessment
title: arc42 migration assessment
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - migration
  - assessment
---

# arc42 migration assessment

## Purpose

Inventory the pre-migration project artifacts, identify contradictions and separate durable project truth from runtime evidence before changing the workflow.

## Status

Assessment completed from the repository state observed on 2026-08-16. It does not claim external release or runtime results.

## Inventory

| Artifact class | Pre-migration inventory | Authority and finding |
| --- | --- | --- |
| Goals | 8 accepted Goal files plus `summary.md`; migration adds accepted goal-009. | Goal files are canonical WHAT/WHY. Summary incorrectly stated strict v9 and no skills/schedule. |
| ADRs | 14 files: adr-001–010 and adr-012–015; adr-004 and adr-010 superseded by adr-015. Migration fills free adr-011. | ADR files remain canonical; no accepted semantic decision is rewritten. |
| ROADMAP | No `.ballet/outputs/ROADMAP.md` exists; only old tasks and historical documents refer to it. | Missing planned output, not a source to preserve. Project direction belongs to Goals/status and initiative BRIEF. |
| DATA-MODEL | `.ballet/outputs/execution-composition/DATA-MODEL.md`. | Explicitly superseded strict-v9 historical evidence; current model comes from ADR-015 and source. |
| C4 | No C4 artifact exists. | Replace the unfulfilled plan with concise context/building-block/runtime/deployment views in arc42 sections 3, 5, 6 and 7. |
| UI | Root `DESIGN.md` plus `.ballet/outputs/execution-composition/UI-DESIGN.md`. | `DESIGN.md` remains canonical. Output UI document is superseded v9 history. |
| Milestone | No `.ballet/outputs/milestones/**` artifacts exist. | Old tasks described hypothetical milestone artifacts; initiative BRIEF/PLAN replaces this active contract. |
| Implementation | Historical execution-composition migration plan and `.ballet/outputs/work-loop/IMPLEMENTATION-PLAN.md`. | Work Loop plan records completed v10 cutover history; active delivery plan becomes initiative PLAN. |
| Test | `.ballet/outputs/execution-composition/TEST-PLAN.md`. | Superseded v9 plan; verified checks map to arc42 quality scenarios and TRACEABILITY. |
| Acceptance | No ACCEPTANCE artifact exists. | Initiative EVIDENCE/REVIEW becomes the active acceptance source. |
| Release | `release-validation` Loop and release instruction; no completed release artifact or Git release evidence in project docs. | Preserve as an unchained, explicitly human-authorized support Loop. |
| Runtime contract | `.ballet/outputs/work-loop/EXECUTION-CONTRACT-V3.md`. | Relevant State/outcome/repair facts move to sections 6/8 and STATE-CONTRACT; platform source/ADR-015 remain authoritative. |
| Instructions | 1 orchestrator file and 9 `migrated-*` files. | IDs are active but filenames/content encode the retired workflow and outdated stop outcomes. Replace references, validate, then remove. |
| Skills | No repository `.agents/skills` directory. | Violates ADR-013's intended workflow procedure layer; create focused arc42 skills. |
| Project config | Strict v10, 4 Loops, 13 Work Loop Nodes, 4 Human validations, 5 profiles, no scheduled Work, all `skillIds` empty. | Generic platform model is current; project-local topology is legacy delivery workflow. |
| Runtime evidence | `.git/ballet/**` SQLite, worktrees, settings and logs. | Execution truth only; never migrate into version-controlled Markdown or Git diff. |

## Conflicts and missing decisions

- **Finding F-MIG-001:** Goal summary described strict v9 although `.ballet/project.json` and source implement strict v10.
- **Finding F-MIG-002:** Active Loop tasks referenced ROADMAP, C4, milestones and acceptance files that do not exist.
- **Finding F-MIG-003:** Project skills were absent even though ADR-013 assigns reusable workflow procedures to skills.
- **Finding F-MIG-004:** Release work could create external effects before an explicit first authorization gate and was automatically downstream from delivery.
- **Finding F-MIG-005:** The existing Orchestrator catalog only knew four legacy Loops and repair Edges were self-only.
- **Finding F-MIG-006:** Existing migrated instructions used legacy `ready`/`changes-requested` stop vocabulary rather than v10 `completed/needs_input/blocked/failed` role outcomes.
- **Open question OQ-001:** The first bounded pilot initiative and owner are not selected.
- **Open question OQ-002:** No operational method-health baseline exists before the first pilot.

No new generic runtime primitive is missing: strict v10 already supports scheduled Work, one shared Root State, strict JSON Patch outcomes, flow/repair LoopEdges, source allowlists and runtime-owned continuation.

## Durable project truth versus runtime evidence

| Durable Markdown/JSON truth | Runtime execution truth |
| --- | --- |
| Goals, ADRs, arc42 sections, initiative BRIEF/PLAN/EVIDENCE/REVIEW, instructions, skills, project config and DESIGN.md | Root/Loop/Node Runs, State revisions, prompts, provider events, Repair Requests, frames, routes, retries and finalization in UI/SQLite |
| Reviewed and version-controlled; summarizes stable conclusions and evidence references | Append-only current execution facts; may be transient or clone-specific |
| Must not copy full logs or State bodies | Must not silently redefine accepted Goals/ADRs or long-lived architecture |

## Canonical sources

Repository files listed above, `README.md`, strict schemas, project resource catalog and `package.json`.

## Relevant decisions

`adr-002`, `adr-011`–`adr-015`.

## Evidence

The inventory was produced from tracked files and project config. External arc42/OpenAI sources were verified separately and do not supply repository runtime facts.

## Open questions

`OQ-001` and `OQ-002` remain open and appear in STATUS/METHOD-HEALTH.

## Next review basis

Re-open only if validation finds an unmapped active source, stale workflow reference or generated runtime artifact in the diff.
