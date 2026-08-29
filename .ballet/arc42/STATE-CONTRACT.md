---
id: arc42-runtime-state-contract-v2
title: Environment runtime state contract
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 10
tags: [arc42, state, runtime-contract]
---

# Environment runtime state contract

Project Config defines immutable intent: Environment, ordered States, prioritized Actions, approved Use Case references and role resources. SQLite v16 defines runtime truth: Environment/State/Action status, agent attempts, events, Feedback, proposals, decisions and continuation lineage.

| Runtime status | Derived `done` | Derived `blocked` | Permitted controller effect |
| --- | --- | --- | --- |
| `pending` | false | false | eligible only after all prior gates |
| `prechecking` | false | false | Validation returns done, delegate or blocked |
| `working` | false | false | Work terminal queues postwork Validation |
| `postchecking` | false | false | Validation returns done, retry or blocked |
| `done` | true | false | contributes to State completion |
| `blocked` | false | true | gates Environment and has causal Feedback |

Runtime never copies documents, diffs, logs, credentials or human authority into project config. Root Snapshot v13 freezes exact project/resource contents and hashes. A continuation imports only unchanged, unaffected done evidence; target and impacted Actions remain pending and the parent remains byte-immutable.
