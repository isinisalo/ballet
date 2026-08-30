---
id: arc42-runtime-state-contract-v2
title: Environment runtime state contract
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 12
tags: [arc42, state, runtime-contract]
---

# Environment runtime state contract

Project Config v23 defines immutable intent: Environment, ordered States with approved Use Case references, prioritized Actions, role resources and fixed governance Agent Skill composition. An Action has no Use Case or Agent reference and inherits its owning State closure. SQLite v21 defines runtime truth: Environment/State/Action status, attempts, Action role model/reasoning selections, events, Feedback, proposals, decisions, local daemon execution facts and continuation lineage.

| Runtime status | Derived `done` | Derived `blocked` | Permitted controller effect |
| --- | --- | --- | --- |
| `pending` | false | false | eligible only after all prior gates |
| `prechecking` | false | false | Validation returns done, delegate or blocked |
| `working` | false | false | Work terminal queues postwork Validation |
| `postchecking` | false | false | Validation returns done, retry or blocked |
| `done` | true | false | contributes to State completion |
| `blocked` | false | true | gates Environment and has causal Feedback |

Runtime never copies documents, bindings, diffs, logs, credentials or human authority into project config. Root Snapshot v18 freezes exact project/resource contents, State-owned approved closure, one Codex Action capability with role-specific model/reasoning, the two fixed read-only Codex Agent definitions, local capability evidence and hashes. A continuation imports only unchanged, unaffected done evidence; a relevant binding, instruction, Agent instruction or Skill change invalidates that Action evidence while the parent remains byte-immutable.
