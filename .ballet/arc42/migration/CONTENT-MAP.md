---
id: arc42-migration-content-map
title: arc42 migration content map
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - migration
  - content-map
---

# arc42 migration content map

## Purpose

Map every legacy artifact class to one canonical target, an initiative artifact, an ADR or an explicitly superseded duplicate.

## Status

Mapping accepted and applied by the migration.

| Source/content | Canonical destination | Action |
| --- | --- | --- |
| `.ballet/goals/goal-001..008` | Section 1 requirement overview; Goal files remain canonical | Link and summarize; never copy full decisions. |
| `.ballet/goals/summary.md` | High-level Goal overview plus ARCHITECTURE/STATUS links | Correct stale v9/count statements. |
| New arc42 authorization | `goal-009`, `adr-011`, section 9 | Create with free IDs and accepted status. |
| `.ballet/adr/*.md` | Section 9 index and relevant section references | Preserve canonical files and semantics. |
| ROADMAP intent | STATUS and initiative BRIEF | Retire artifact expectation; no source file existed. |
| v9 DATA-MODEL | Sections 4, 5 and 8 plus ADR-015/source | Move current ownership/structure facts; supersede old path. |
| C4 intent | Sections 3, 5, 6 and 7 | Provide concise context, building-block, runtime and deployment views; no old file existed. |
| `DESIGN.md` | Section 8 CON-005 links to root source | Preserve DESIGN.md verbatim as canonical; do not copy it. |
| v9 UI-DESIGN output | DESIGN.md and section 8 | Retain only current execution-composition concepts; supersede old output. |
| milestone scope/issues | Initiative BRIEF | Replace milestone vocabulary with bounded initiative intent and sources. |
| implementation plans | Initiative PLAN; sections 4/5/8 for enduring architecture | Keep historical cutover files only as superseded pointers. |
| test plans | Section 10, TRACEABILITY and initiative PLAN/EVIDENCE | Convert enduring criteria to measurable QS/test IDs. |
| acceptance intent/results | Initiative EVIDENCE and REVIEW | No old file existed; do not fabricate results. |
| release/deploy procedure | Unchained `release-validation`, release instruction, RT-005, QS-007 | Add authorization gate and keep external writes explicit. |
| Work Loop V3 contract | ADR-015, STATE-CONTRACT, sections 6/8 | Link canonical runtime sources; supersede duplicate output path. |
| Legacy instructions | New role instructions under `.ballet/instructions/` | Update all config refs, validate catalog, then delete `migrated-*`. |
| Reusable workflow procedures | `.agents/skills/arc42/*/SKILL.md` | Create concise skills and select them explicitly per Node. |
| Legacy 4-Loop topology | 6+1 arc42 Loops plus unchained release support | Replace project-local config; no platform change. |
| Runtime State/logs | Runtime UI/SQLite only | Exclude from version-controlled migration. |

## Duplicate policy

Old output paths referenced by historical ADRs are reduced to small `superseded` pointer documents after their current facts have moved. This preserves Git history and link resolution without leaving two active sources of truth. Nonexistent planned outputs are not created as redirects.

## Canonical sources

ASSESSMENT owns the inventory, this map owns migration routing, DECISIONS owns the safe sequence and the arc42 index owns the final navigation.

## Relevant decisions

`adr-011`, `adr-013`, `adr-014`, `adr-015`.

## Evidence

`npm run validate:arc42`, resource-catalog validation and legacy-reference search verify the applied map.

## Open questions

- None for routing. Pilot-specific content starts from the initiative template.

## Next review basis

Review if an active legacy source survives outside the mapped canonical paths.
