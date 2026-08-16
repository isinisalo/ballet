---
id: arc42-section-05
title: Building block view
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 3
tags:
  - arc42
  - building-blocks
arc42Section: 5
---

# 5. Building block view

## Purpose

Describe the architecturally significant static decomposition and map every block to source and interfaces.

## Status

Level 1 is verified from the repository. Deeper detail is added only for risk, complexity or an active initiative.

| ID | Building block and responsibility | Interfaces | Quality significance | Source location | Requirements | Open risks |
| --- | --- | --- | --- | --- | --- | --- |
| BB-001 | Frontend operator workspace: Configure/Run navigation, three-level Loop Engineer, editors and runtime evidence. | Loopback HTTP/SSE through shared API DTOs. | Unambiguous, accessible operation. | `frontend/src/` | REQ-001, REQ-007, REQ-011 | UI/read-model drift if shared contracts are bypassed. |
| BB-002 | Local HTTP service and application services: validate requests, expose workspace and Run operations. | Express routes and service interfaces. | Closed local boundary and fail-closed validation. | `backend/http/`, `backend/server/`, `backend/services/` | REQ-001, REQ-006 | Originless local clients remain within the documented loopback trust boundary. |
| BB-003 | Project document/config catalog: load strict-v10 config, Markdown instructions and project skills. | `ProjectConfigurationRepository`, resource catalog and workspace DTOs. | Portable and deterministic project truth. | `backend/project-config/`, `backend/documents/`, `shared/api/workspace-schemas.ts` | REQ-002, REQ-003, REQ-009 | Broken or duplicate resources must remain blocking. |
| BB-004 | Root Run planner/coordinator: snapshot reachable config and manage lifecycle/finalization. | Run services, execution planner, worktree manager and runtime engine. | Reproducibility and active-checkout safety. | `backend/runs/` | REQ-004, REQ-005, REQ-006 | Snapshot size and finalization races. |
| BB-005 | Work Loop runtime: Work/Validation outcomes, revisioned State, retry, repair, frames and continuation. | Runtime stores and strict role outcomes. | Atomicity, recoverability and deterministic control flow. | `backend/runtime/`, `backend/runtime/state/` | REQ-004, REQ-006, REQ-009 | Nested repair complexity; bounded by depth/attempt/transition limits. |
| BB-006 | Provider execution: compose prompts, enforce runtime policy, queue Codex/Copilot and normalize events. | `ExecutionProfile`, provider adapters and `ExecutionTask`. | Provider neutrality, least privilege and evidence integrity. | `backend/execution/`, `backend/integration/` | REQ-003, REQ-005 | Provider capability changes can block preflight. |
| BB-007 | Checkout lifecycle and distribution: CLI, launchd, Git worktrees, packaging and verified update. | Local shell/Git, launchd and release artifacts. | Isolation and supply-chain integrity. | `backend/cli/`, `backend/execution/git/`, `scripts/`, `packaging/` | REQ-005, REQ-008 | Remote release dependencies require explicit authority and availability. |
| BB-008 | Project-local arc42 Method resources: architecture docs, initiative artifacts, Loops, instructions, skills and validator. | Stable Markdown/JSON paths and npm validation command. | Shared intent, traceability and evidence-driven improvement. | `.ballet/arc42/`, `.ballet/project.json`, `.ballet/instructions/`, `.agents/skills/arc42/` | REQ-002, REQ-009 | First-pilot effectiveness evidence is pending. |
| BB-009 | Loop module authoring boundary: strict package inspection, local library, deterministic install plan/materialization, export closure and provenance-aware removal. | Loop module DTOs/API; project config mutation queue; resource catalog. | Supply-chain visibility, atomic project references and portable reuse. | `shared/domain/loopModules.ts`, `shared/api/loop-module-schemas.ts`, `backend/loop-modules/`, Loop Library UI | REQ-002, REQ-007, REQ-010 | Remote distribution/update trust is intentionally undecided. |

### BB-001 whitebox: Loop Engineer authoring workspace

| Element | Responsibility | Interfaces and ownership | Source location |
| --- | --- | --- | --- |
| Route state and shell | Parse and generate canonical `context | composition | detail` locations; render one title, breadcrumb and level navigation. | URL is the active-level source of truth; route changes do not mutate domain data. | `frontend/src/workspace/routing.ts`, `frontend/src/workspace/automation/LoopEngineerShell.tsx` |
| Context projection and canvas | Summarize Project intent, Loop system and observable outcomes without inventing runtime entities or capability prose. | Read-only projection from `WorkspaceDataDto`; conceptual arrows are not persisted Edges. | `frontend/src/workspace/automation/loops/loopEngineerProjections.ts`, `LoopContextCanvas.tsx` |
| Composition projection and canvas | Render exactly one rectangular black-box node per `ProjectLoop` and exactly the project-global `ProjectLoopEdge` topology. | Owns Loop selection and the Level 1 inspector; only `LoopEdgesEditor` writes cross-Loop connections. | `frontend/src/workspace/automation/loops/LoopCompositionCanvas.tsx`, `LoopCompositionWorkspace.tsx` |
| Detail projection and editor | Render only the selected Loop's composite Work Loop Nodes, `ProjectNodeEdge` connections and terminal targets. | Owns internal Loop definition and node editing; never displays or writes `ProjectLoopEdge`. | `frontend/src/workspace/automation/loops/LoopEditor.tsx`, `LoopCanvas.tsx`, `loopLayout.ts` |
| Module install handoff | Await install, refresh authoritative workspace/module status and select the materialized project-local Loop on Level 1. | Existing BB-009 API; recommended connections remain advisory only. | `frontend/src/workspace/automation/AutomationView.tsx`, `LoopLibraryDialog.tsx` |

## Canonical sources

Source directories and shared contracts are authoritative for implementation; ADRs define ownership boundaries and this view defines their architecture-level decomposition.

## Relevant decisions

`adr-001`–`adr-003`, `adr-005`–`adr-008`, `adr-011`–`adr-017`.

## Evidence

Repository paths exist and `npm run build` verifies their compile-time composition. Tests named in TRACEABILITY exercise critical boundaries.

## Open questions

- Whether BB-008 needs a deeper whitebox after the first pilot; no extra layer is created without a concrete complexity signal.

## Next review basis

Review when responsibilities, public interfaces or source ownership move between blocks.
