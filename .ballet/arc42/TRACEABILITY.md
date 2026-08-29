---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 30
tags: [arc42, traceability, evidence]
---

# Balletin arkkitehtuurin jäljitettävyys

<!-- traceability:start -->
| Goal/Requirement | Quality Scenario | ADR/Concept | Building Block | Runtime/Deployment Scenario | Test/Monitor | Evidence | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| goal-022 / REQ-022 | QS-028 | adr-034 / CON-015 | BB-015 | RT-026 / DEP-005 | TEST-028 | EVID-028 | RISK-023 | passed locally; operational pilot open |
| goal-022 / REQ-022 | QS-029 | adr-034 / CON-015 | BB-015 | RT-027 / DEP-005 | TEST-029 | EVID-029 | RISK-023 | passed locally |
| goal-022 / REQ-022 | QS-030 | adr-034 / CON-015 | BB-015 | RT-028 / DEP-005 | TEST-030 | EVID-030 | RISK-023 | passed locally; operational pilot open |
| goal-022 / REQ-022 | QS-031 | adr-034 / CON-015 | BB-015 | RT-026 / RT-027 / RT-028 / DEP-005 | TEST-031 | EVID-031 | RISK-023 | passed canonical |
| goal-022 / REQ-022 | QS-032 | adr-034 / CON-015 | BB-015 | RT-026 / RT-027 / RT-028 / DEP-005 | TEST-032 | EVID-032 | RISK-023 | passed locally |
<!-- traceability:end -->

## Canonical Use Case coverage

<!-- use-case-traceability:start -->
| Use Case | Goal / ADR | Primary invariant | Executable evidence owner | Status |
| --- | --- | --- | --- | --- |
| UC-01 | goal-002, goal-022 / adr-002, adr-034 | Direction closure is explicit and version-controlled. | TEST-032 / EVID-032 | default resource validation pending final gate |
| UC-02 | goal-022 / adr-008, adr-034 | Only exact human-approved semantic content is runnable. | TEST-028, TEST-031 / EVID-028, EVID-031 | implementation evidence under final review |
| UC-03 | goal-009, goal-022 / adr-011, adr-013, adr-034 | Task context contains referenced decisions and resources. | TEST-028, TEST-032 / EVID-028, EVID-032 | implementation evidence under final review |
| UC-04 | goal-002, goal-022 / adr-034 | Environment has unique ascending State order. | TEST-028, TEST-031 / EVID-028, EVID-031 | implementation evidence under final review |
| UC-05 | goal-022 / adr-034 | Only first pending Action in first incomplete State runs. | TEST-028 / EVID-028 | implementation evidence under final review |
| UC-06 | goal-002, goal-022 / adr-012, adr-013, adr-034 | Action is bounded and has exact role/resource composition. | TEST-028, TEST-032 / EVID-028, EVID-032 | default resource validation pending final gate |
| UC-07 | goal-022 / adr-034 | Validation precheck precedes Work and requires evidence. | TEST-028 / EVID-028 | implementation evidence under final review |
| UC-08 | goal-005, goal-022 / adr-005, adr-006, adr-012, adr-034 | Work is subordinate and managed-worktree scoped. | TEST-028 / EVID-028 | implementation evidence under final review |
| UC-09 | goal-006, goal-022 / adr-007, adr-034 | `1 + maxRetries`; exhaustion creates atomic blocked Feedback. | TEST-028, TEST-029 / EVID-028, EVID-029 | implementation evidence under final review |
| UC-10 | goal-006, goal-022 / adr-006, adr-007, adr-034 | Product Snapshot is terminal, immutable and factual. | TEST-030, TEST-032 / EVID-030, EVID-032 | implementation evidence under final review |
| UC-11 | goal-006, goal-022 / adr-007, adr-034 | Critic is disabled by default, read-only and non-overlapping. | TEST-029, TEST-031 / EVID-029, EVID-031 | implementation evidence under final review |
| UC-12 | goal-022 / adr-008, adr-034 | Human approval creates exactly one provenance-bound Feedback entry. | TEST-029, TEST-031 / EVID-029, EVID-031 | implementation evidence under final review |
| UC-13 | goal-005, goal-006, goal-022 / adr-006, adr-034 | Exact approved apply creates one commit and immutable continuation. | TEST-030, TEST-031 / EVID-030, EVID-031 | implementation evidence under final review |
<!-- use-case-traceability:end -->

| ID | Tarkistus |
| --- | --- |
| TEST-028 | strict v20/v13/v10/v11/v12/v16 schemas, ordering, Validation loop, retry/provider-failure split, restart and no standalone run tests |
| TEST-029 | blocked+Feedback transaction, schedule/DST/lease/recovery, Critic read set and exact human approval tests |
| TEST-030 | refinement allowlist/preimage/hash/impact/Git/lineage/Product Snapshot tests |
| TEST-031 | canonical component, routing, keyboard, accessibility and 1440x900/390x844 browser QA |
| TEST-032 | removal grep, exact version, full suite, docs/design, release smoke, local install/startup and clean-tree gates |

| ID | Evidenssi |
| --- | --- |
| EVID-028 | initiative ESAO-evid-003–005/007 plus final runtime occurrence result |
| EVID-029 | initiative ESAO-evid-004/006/007/009 plus final occurrence result |
| EVID-030 | initiative ESAO-evid-004/006/007/009 plus final continuation result |
| EVID-031 | initiative ESAO-evid-008/009 plus canonical browser evidence |
| EVID-032 | final cutover command log, release/install/startup evidence and removal gate |
