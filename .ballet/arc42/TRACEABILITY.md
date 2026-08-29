---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 29
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
