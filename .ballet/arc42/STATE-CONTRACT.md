---
id: arc42-runtime-state-contract-v2
title: Environment runtime state contract
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 14
tags: [arc42, state, runtime-contract]
---

# Environment runtime state contract

Project Config v26 defines immutable intent: Environment, ordered States, prioritized Actions, Action Agent IDs, role Skill resources, project-local direction documents and governance composition. State and Action have no User Story reference. SQLite v24 defines runtime truth: Environment/State/Action status, attempts, events, Feedback, proposals, decisions, local daemon execution facts and continuation lineage; it stores no parallel Action model/reasoning binding.

| Runtime status | Derived `done` | Derived `blocked` | Permitted controller effect |
| --- | --- | --- | --- |
| `pending` | false | false | eligible only after all prior gates |
| `prechecking` | false | false | Validation returns done, delegate or blocked |
| `working` | false | false | Work terminal queues postwork Validation |
| `postchecking` | false | false | Validation returns done, retry or blocked |
| `done` | true | false | contributes to State completion |
| `blocked` | false | true | gates Environment and has causal Feedback |

Runtime never copies project documents, diffs, logs, credentials or human authority into project config. Root Snapshot v21 freezes every Action Agent definition and TOML hash, its selected Skill closure, the two fixed read-only governance Agent definitions and local capability evidence; it contains no automatic User Story closure. A continuation imports only unchanged, unaffected done evidence; a relevant Action Agent instruction or Skill change invalidates that Action evidence while the parent remains byte-immutable.
