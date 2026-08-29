---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 34
tags: [arc42, traceability, evidence]
---

# Balletin arkkitehtuurin jäljitettävyys

<!-- traceability:start -->
| Goal/Requirement | Quality Scenario | ADR/Concept | Building Block | Runtime/Deployment Scenario | Test/Monitor | Evidence | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| goal-022 / REQ-022 | QS-028 | adr-034 / CON-015 | BB-015 | RT-026 / DEP-005 | TEST-028 | EVID-028 | RISK-023 | passed locally |
| goal-022 / REQ-022 | QS-029 | adr-034 / CON-015 | BB-015 | RT-027 / DEP-005 | TEST-029 | EVID-029 | RISK-023 | passed locally |
| goal-022 / REQ-022 | QS-030 | adr-034 / CON-015 | BB-015 | RT-028 / DEP-005 | TEST-030 | EVID-030 | RISK-023 | passed locally |
| goal-022 / REQ-022 | QS-031 | adr-034 / CON-015 | BB-015 | RT-026 / RT-027 / RT-028 / DEP-005 | TEST-031 | EVID-031 | RISK-023 | passed canonical |
| goal-022 / REQ-022 | QS-032 | adr-034 / CON-015 | BB-015 | RT-026 / RT-027 / RT-028 / DEP-005 | TEST-032 | EVID-032 | RISK-023 | passed locally |
| goal-023 / REQ-023 | QS-033 | adr-035 / CON-016 | BB-016 | RT-029 / DEP-006 | TEST-033 | EVID-033 | RISK-024 | passed locally |
| goal-023 / REQ-023 | QS-034 | adr-035 / CON-016 | BB-016 | RT-030 / DEP-006 | TEST-034 | EVID-034 | RISK-024 | passed locally |
| goal-023 / REQ-023 | QS-035 | adr-035 / CON-016 | BB-016 | RT-030 / DEP-006 | TEST-035 | EVID-035 | RISK-024 | passed locally |
| goal-023 / REQ-023 | QS-036 | adr-035 / CON-016 | BB-016 | RT-031 / DEP-006 | TEST-036 | EVID-036 | RISK-024 | passed locally |
| goal-023 / REQ-023 | QS-037 | adr-035 / CON-016 | BB-016 | RT-029 / RT-030 / RT-031 / DEP-006 | TEST-037 | EVID-037 | RISK-024 | passed locally |
<!-- traceability:end -->

## Canonical Use Case coverage

<!-- use-case-traceability:start -->
| Use Case | Goal / ADR | Primary invariant | Executable evidence owner | Status |
| --- | --- | --- | --- | --- |
| UC-01 | goal-002, goal-022 / adr-002, adr-034 | Direction closure is explicit and version-controlled. | TEST-032 / EVID-032 | passed |
| UC-02 | goal-022 / adr-008, adr-034 | Only exact human-approved semantic content is runnable. | TEST-028, TEST-031 / EVID-028, EVID-031 | passed |
| UC-03 | goal-009, goal-022 / adr-011, adr-013, adr-034 | Task context contains referenced decisions and resources. | TEST-028, TEST-032 / EVID-028, EVID-032 | passed |
| UC-04 | goal-002, goal-022 / adr-034 | Environment has unique ascending State order. | TEST-028, TEST-031 / EVID-028, EVID-031 | passed |
| UC-05 | goal-022 / adr-034 | Only first pending Action in first incomplete State runs. | TEST-028 / EVID-028 | passed |
| UC-06 | goal-002, goal-022 / adr-012, adr-013, adr-034 | Action is bounded and has exact role/resource composition. | TEST-028, TEST-032 / EVID-028, EVID-032 | passed |
| UC-07 | goal-022 / adr-034 | Validation precheck precedes Work and requires evidence. | TEST-028 / EVID-028 | passed |
| UC-08 | goal-005, goal-022 / adr-005, adr-006, adr-012, adr-034 | Work is subordinate and managed-worktree scoped. | TEST-028 / EVID-028 | passed |
| UC-09 | goal-006, goal-022 / adr-007, adr-034 | `1 + maxRetries`; exhaustion creates atomic blocked Feedback. | TEST-028, TEST-029 / EVID-028, EVID-029 | passed |
| UC-10 | goal-006, goal-022 / adr-006, adr-007, adr-034, adr-035 | Run Evidence is terminal, immutable, factual and embedded in its owning Run. | TEST-030, TEST-032, TEST-037 / EVID-030, EVID-032, EVID-037 | passed |
| UC-11 | goal-006, goal-022 / adr-007, adr-034 | Critic is disabled by default, read-only and non-overlapping. | TEST-029, TEST-031 / EVID-029, EVID-031 | passed |
| UC-12 | goal-022 / adr-008, adr-034 | Human approval creates exactly one provenance-bound Feedback entry. | TEST-029, TEST-031 / EVID-029, EVID-031 | passed |
| UC-13 | goal-005, goal-006, goal-022 / adr-006, adr-034 | Exact approved apply creates one commit and immutable continuation. | TEST-030, TEST-031 / EVID-030, EVID-031 | passed |
<!-- use-case-traceability:end -->

| ID | Tarkistus |
| --- | --- |
| TEST-028 | strict v21/v14/v11/v12/v13/v17 schemas, ordering, Validation loop, retry/provider-failure split, restart and no standalone run tests |
| TEST-029 | blocked+Feedback transaction, schedule/DST/lease/recovery, Critic read set and exact human approval tests |
| TEST-030 | refinement allowlist/preimage/hash/impact/Git/lineage/Run Evidence tests |
| TEST-031 | canonical component, routing, keyboard, accessibility and 1440x900/390x844 browser QA |
| TEST-032 | removal grep, exact version, full suite, docs/design, release smoke, local install/startup and clean-tree gates |
| TEST-033 | Markdown round-trip/dirty guard, old-style workspace routes, keyboard/accessibility and desktop/narrow browser QA |
| TEST-034 | pairing/credential/TLS-loopback/heartbeat/claim/lease/fencing/replay/restart/control-plane security tests |
| TEST-035 | Agent definition/binding, same-device exact checkout/config preflight and Codex/Copilot adapter tests |
| TEST-036 | strict minimal Feedback API, trusted provenance and resource-only Refinement path/hash/approval tests |
| TEST-037 | exact v21/v14/v11/v12/v13/v17 contracts, Run Evidence, removal/full/release/install/startup/clean-tree gates |

| ID | Evidenssi |
| --- | --- |
| EVID-028 | initiative ESAO-evid-003–005/007 plus final runtime occurrence result |
| EVID-029 | initiative ESAO-evid-004/006/007/009 plus final occurrence result |
| EVID-030 | initiative ESAO-evid-004/006/007/009 plus final continuation result |
| EVID-031 | initiative ESAO-evid-008/009 plus canonical browser evidence |
| EVID-032 | final cutover command log, release/install/startup evidence and removal gate |
| EVID-033 | Markdown/Loop Engineering UI test and browser evidence |
| EVID-034 | paired daemon transaction, restart and security evidence |
| EVID-035 | Agent binding and two-CLI readiness/dispatch evidence |
| EVID-036 | Feedback/Refinement v2 strict boundary evidence |
| EVID-037 | final strict cutover, Run Evidence and packaged startup evidence |
