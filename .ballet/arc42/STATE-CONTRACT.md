---
id: arc42-state-contract-v1
title: Arc42MethodStateV1 contract
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - state
  - runtime-contract
---

# Arc42MethodStateV1 contract

## Purpose

Define the bounded shared runtime State used by every arc42 Loop. State coordinates work; Markdown remains the long-lived project truth.

## Status

Version 1 is accepted by `adr-011` and implemented as the structurally identical initial value of all arc42 Loops.

## Initial value

<!-- arc42-state-initial:start -->
```json
{
  "contractVersion": "Arc42MethodStateV1",
  "initiative": {
    "id": null,
    "status": "unselected",
    "briefPath": null,
    "goalIds": [],
    "openQuestionIds": []
  },
  "architecture": {
    "status": "baseline",
    "qualityScenarioIds": [],
    "adrIds": [],
    "buildingBlockIds": [],
    "riskIds": []
  },
  "delivery": {
    "status": "not_started",
    "planPath": null,
    "changedArtifactPaths": [],
    "checkIds": [],
    "conformanceFindingIds": []
  },
  "release": {
    "status": "not_requested",
    "authorization": null,
    "evidenceIds": []
  },
  "evaluation": {
    "status": "not_started",
    "evidenceIds": [],
    "findingIds": [],
    "methodHealthUpdatedAt": null
  },
  "handoff": {
    "status": "pending",
    "summary": null,
    "nextLoopId": null,
    "nextAction": null,
    "changedArtifactPaths": [],
    "stableIds": [],
    "checks": []
  }
}
```
<!-- arc42-state-initial:end -->

## Field ownership

| Area | Content | Prohibited content |
| --- | --- | --- |
| `initiative` | Selected initiative, BRIEF path, Goal IDs, open-question IDs | Full BRIEF text or invented WHAT/WHY |
| `architecture` | Status and stable QS/ADR/BB/RISK references | Copied arc42 sections or hidden reasoning |
| `delivery` | PLAN path, changed paths, check and conformance IDs | Source diffs, test logs or secrets |
| `release` | Request status, exact human authorization reference, evidence IDs | Credentials or implicit permission |
| `evaluation` | Evidence/finding IDs and health update time | Unreferenced model opinions |
| `handoff` | Concise summary, next Loop/action and patch evidence | Continuation or return-target choice |

## Patch obligations

- Work completed and Validation OK may propose only `add`, `remove` and `replace` operations allowed by ADR-015.
- Each patch is bounded to the fields owned by the current Node's task. It must not replace the whole State or copy document bodies.
- Patch evidence updates `handoff.changedArtifactPaths`, `handoff.stableIds` and `handoff.checks`. A check entry records a stable check ID, command or observation, status and evidence reference.
- Validation FAIL never patches State. Local retry feedback or an Orchestrator Repair Request carries the correction need.
- The model never writes continuation, return target, repair edge, permission or network policy into State as a control instruction.

## Canonical sources

`adr-015` owns atomic State revision semantics. `adr-011` owns this project-local shape. Task Envelope V3 and role output schema V3 remain the runtime transport contracts.

## Relevant decisions

`adr-006`, `adr-010` (superseded history), `adr-011`, `adr-015`.

## Evidence

`npm run validate:arc42` compares every arc42 Loop initial value structurally with this contract and with every other arc42 Loop.

## Open questions

- Whether a future measured need justifies a version 2 field. No field is added from model preference alone.

## Next review basis

Review only after a pilot produces a repeated, evidenced coordination gap that cannot be expressed with existing stable references.
