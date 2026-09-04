---
id: ltd-evidence-001
title: Loop Engineering three-level Dagre evidence
status: accepted
createdAt: '2026-09-04'
updatedAt: '2026-09-04'
version: 6
tags: [arc42, initiative, evidence, loop-engineering]
---

# Loop Engineering three-level Dagre EVIDENCE

| Evidence ID | Scenario | Claim | Source | Result | Boundary |
| --- | --- | --- | --- | --- | --- |
| LTD-evid-001 | QS-033 | deterministic STATE -> ACTION -> AGENTS projection and interaction | `loopEngineeringProjection.ts`, `LoopEngineeringCanvas`, targeted tests | expected red recorded; targeted green 89/89; final focused UI 55/55 | authoring projection only |
| LTD-evid-002 | QS-033 / adr-042 | URL-owned Agent/create panes preserve one Action draft and atomic save | routing, workspace components and tests | route, creation, invalid-query, subview draft and atomic-save tests passed | no API/schema/runtime change |
| LTD-evid-003 | QS-033 / adr-044 | planet and standalone Action-flow source are absent; docs/design conform | source removal, canonical docs and repository gates | arc42, cutover and DESIGN lint passed; lint 0 errors; build passed; active-source removal search 0 | historical ADR/evidence text remains audit trail |
| LTD-evid-004 | QS-033 / adr-044 | responsive graph and settings are usable at accepted viewports and packaged startup is healthy | `output/playwright/loop-dagre-desktop.png`, `loop-dagre-narrow.png`, `loop-dagre-create-state.png`; `make latest` | desktop shows all three ranks; narrow body/html 390/390 px, controls 40×44 px; console 0/0; packaged health/deep link passed; archive SHA-256 `a6497ae5ed6d81c44cdf24e3fd3c320645e154efbdf6cb28656b37e5f970c111` | no merge, push, release publication or deploy |
| LTD-evid-005 | QS-033 / adr-045 | all steering refinements remain one coherent projection | focused projection/sidebar tests and `output/playwright/loop-edge-circle-endpoints-25.png`; `make latest` | focused canvas 13/13 and sidebar 1/1; Action selection retains all State -> Action edges; unselected nodes and branch/order edges exact 25 % opacity; path coordinates use detached source/target circle centers; circles exactly 8 px outside fixed side centers; 36 px row and 144 px rank gaps; 1.5 px Bézier; concise canvas/sidebar labels; desktop console 0/0 | visual authoring refinement only; no external write |

The red phase failed for the intended missing projection (`projection.nodes`) and missing Agent route (`createMode`) before implementation. The matching targeted green run passed 89 tests after projection, routing, creation and shared-draft behavior were implemented. Steering red phases then exposed the previous tight spacing, missing concise labels, straight routing, wrong floating interpretation and repeated sidebar State prefix before the focused green runs. The checkout's full test command has one unrelated failure because the user's preserved `.ballet/project.json` orders States `[2,3,4,5,1]`; all other 328/329 tests pass there. A clean canonical-project verification is represented by the scoped 38 files / 328 tests without changing that user-owned file.
