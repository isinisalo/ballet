---
id: arc42-traceability
title: Balletin arkkitehtuurin jäljitettävyys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 51
tags: [arc42, traceability, evidence]
---

# Balletin arkkitehtuurin jäljitettävyys

Stable IDs retain delivery history. A dated passing result is evidence for that revision, not a second active contract. Current versions: [ARCHITECTURE](../../ARCHITECTURE.md#active-version-matrix); latest rerun: [STATUS](STATUS.md). Historical binding/pairing checks below are superseded by TEST-038/TEST-043.

<!-- traceability:start -->
| Overview/Requirement | Quality Scenario | ADR/Concept | Building Block | Runtime/Deployment Scenario | Test/Monitor | Evidence | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-022 | QS-028 | adr-034 / CON-015 | BB-015 | RT-026 / DEP-005 | TEST-028 | EVID-028 | RISK-023 | passed locally |
| REQ-022 | QS-029 | adr-034 / CON-015 | BB-015 | RT-027 / DEP-005 | TEST-029 | EVID-029 | RISK-023 | passed locally |
| REQ-022 | QS-030 | adr-034 / CON-015 | BB-015 | RT-028 / DEP-005 | TEST-030 | EVID-030 | RISK-023 | passed locally |
| REQ-022 | QS-031 | adr-034 / CON-015 | BB-015 | RT-026 / RT-027 / RT-028 / DEP-005 | TEST-031 | EVID-031 | RISK-023 | passed canonical |
| REQ-022 | QS-032 | adr-034 / CON-015 | BB-015 | RT-026 / RT-027 / RT-028 / DEP-005 | TEST-032 | EVID-032 | RISK-023 | passed locally |
| REQ-023 | QS-033 | adr-035,adr-045 / CON-016 | BB-016,BB-018 | RT-029 / DEP-006 | TEST-033 | EVID-033 | RISK-024 | passed canonical; current rerun in STATUS |
| REQ-023 | QS-034 | adr-035 / CON-016 | BB-016 | RT-030 / DEP-006 | TEST-034 | EVID-034 | RISK-024 | historical result; superseded scope in section 10 |
| REQ-023 | QS-035 | adr-035 / CON-016 | BB-016 | RT-030 / DEP-006 | TEST-035 | EVID-035 | RISK-024 | passed locally |
| REQ-023 | QS-036 | adr-035 / CON-016 | BB-016 | RT-031 / DEP-006 | TEST-036 | EVID-036 | RISK-024 | passed locally |
| REQ-023 | QS-037 | adr-035 / CON-016 | BB-016 | RT-029 / RT-030 / RT-031 / DEP-006 | TEST-037 | EVID-037 | RISK-024 | historical result; superseded scope in section 10 |
| REQ-024 | QS-038 | adr-037 / CON-017 | BB-017 | RT-032 / DEP-007 | TEST-038 | EVID-038 | RISK-025 | passed canonical |
| REQ-023,REQ-024 | QS-039 | adr-040 / CON-017 | BB-016,BB-017 | RT-026,RT-032 / DEP-007 | TEST-039 | EVID-039 | RISK-025 | passed locally |
| REQ-023,REQ-024 | QS-040 | adr-040 / CON-017 | BB-016,BB-017 | RT-026,RT-032 / DEP-007 | TEST-040 | EVID-040 | RISK-025 | historical result; superseded scope in section 10 |
| REQ-024 | QS-041 | adr-040 / CON-017 | BB-017 | RT-033 / DEP-007 | TEST-041 | EVID-041 | RISK-025 | historical result; superseded scope in section 10 |
| REQ-022 | QS-042 | adr-041 / CON-015 | BB-015,BB-016 | RT-026,RT-029 / DEP-007 | TEST-042 | EVID-042 | RISK-023 | passed locally |
| REQ-023,REQ-024 | QS-043 | adr-042 / CON-018 | BB-018 | RT-034 / DEP-008 | TEST-043 | EVID-043 | RISK-025 | passed canonical |
| Overview | QS-044 | adr-046 / CON-019 | BB-019 | RT-035 | TEST-044 | EVID-044 | document-wide conflicts | passed locally |
| REQ-023 | QS-045 | adr-047 / CON-016 | BB-016 | RT-029 / DEP-006 | TEST-045 | EVID-045 | RISK-024 | passed canonical |
| REQ-025 | QS-046 | adr-048 / CON-020 | BB-020 | RT-036 | TEST-046 | EVID-046 | stale or duplicated intent | passed locally 2026-09-06 |
<!-- traceability:end -->

## Current requirement coverage

Former source IDs and unchanged approvals are in the [historical conversion record](../history/project-definition-2026-09-06/README.md). Converted stories are Draft; passing tests do not approve them.

| Current requirement | Scope | Executable evidence owner | Agreement |
| --- | --- | --- | --- |
| [54625950-26fb-46fe-90e3-f4cf31084368](../user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md) | Define project direction | TEST-046 / EVID-046 | Draft; awaits human approval |
| [9b094976-5840-4764-8c2d-9a42559a09d6](../user-stories/9b094976-5840-4764-8c2d-9a42559a09d6.md) | Describe and approve a User Story | TEST-046 / EVID-046 | Draft; awaits human approval |
| [Overview](../overview.md#project-truth-and-explicit-context) | Provide architecture decisions to agents | TEST-042 / EVID-046 | Shared requirement |
| [b87320a0-3e7c-4a59-b120-4fa7e3d95b7c](../user-stories/b87320a0-3e7c-4a59-b120-4fa7e3d95b7c.md) | Model work as an Environment | TEST-028 / EVID-046 | Draft; awaits human approval |
| [Overview](../overview.md#ordered-execution-and-validation) | Process State Actions by priority | TEST-028 / EVID-046 | Shared requirement |
| [837f8ecb-c3e7-46d5-a8a4-9521f37542e4](../user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md) | Define an Action | TEST-043 / EVID-046 | Draft; awaits human approval |
| [Overview](../overview.md#ordered-execution-and-validation) | Check Action readiness | TEST-028 / EVID-046 | Shared requirement |
| [Overview](../overview.md#ordered-execution-and-validation) | Delegate bounded work to a subordinate agent | TEST-028 / EVID-046 | Shared requirement |
| [Overview](../overview.md#ordered-execution-and-validation) | Retry or block an Action | TEST-029 / EVID-046 | Shared requirement |
| [a172e384-43eb-4fb3-95ca-9d42ab52a5f7](../user-stories/a172e384-43eb-4fb3-95ca-9d42ab52a5f7.md) | Form the final Run Evidence | TEST-030 / EVID-046 | Draft; awaits human approval |
| [ff255f3a-5748-42da-904c-311cc9ff9c43](../user-stories/ff255f3a-5748-42da-904c-311cc9ff9c43.md) | Run scheduled quality criticism | TEST-029 / EVID-046 | Draft; awaits human approval |
| [9def77e6-89c3-4ef3-b295-89323c592807](../user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md) | Approve and collect Feedback | TEST-036 / EVID-046 | Draft; awaits human approval |
| [cc322abc-96e2-41ef-93f8-1b5aba633995](../user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md) | Refine an Action and rerun immutably | TEST-030 / EVID-046 | Draft; awaits human approval |


| ID | Tarkistus |
| --- | --- |
| TEST-028 | active [strict schemas](../../shared/orchestration/versions.ts), ordering, Validation loop, retry/provider-failure split, restart and no standalone run tests |
| TEST-029 | blocked+Feedback transaction, schedule/DST/lease/recovery, Critic read set and exact human approval tests |
| TEST-030 | refinement allowlist/preimage/hash/impact/Git/lineage/Run Evidence tests |
| TEST-031 | canonical component, routing, keyboard, accessibility and 1440x900/390x844 browser QA |
| TEST-032 | removal grep, exact version, full suite, docs/design, release smoke, local install/startup and clean-tree gates |
| TEST-033 | Markdown round-trip/dirty guard, canonical workspace routes, deterministic spacious Dagre State/Action/Agents projection, concise labels, selected-branch floating Bézier edges, create/Agent subviews, shared Action draft, keyboard/accessibility and desktop/narrow browser QA |
| TEST-034 | Historical ADR-035 pairing/credential/TLS-loopback/heartbeat/claim/lease/fencing/replay/restart/control-plane security tests |
| TEST-035 | exact two Agent TOMLs, checkout/config preflight and Codex adapter tests |
| TEST-036 | strict minimal Feedback API, trusted provenance and resource-only Refinement path/hash/approval tests |
| TEST-037 | Historical ADR-035 exact v21/v14/v11/v12/v13/v17 contracts, Run Evidence, removal/full/release/install/startup/clean-tree gates |
| TEST-038 | local daemon lifecycle, atomic one-time claim, lease renewal/expiry, stale fencing, duplicate terminal, queued restart and fail-closed recovery tests |
| TEST-039 | fixed Agent TOML parse/serialize/path/symlink/hash and atomic TOML+Skill rollback; historical Action binding v3 (superseded by TEST-043), loopback auth and UI tests |
| TEST-040 | Historical ADR-040 exact v24/v19/v11/v15/v17/v22/v2/v3 contracts, automatic Use Case closure and general Agent removal, nested Skills, full docs/design/browser gates, make latest and packaged startup smoke |
| TEST-041 | Historical ADR-040 strict ActionExecutionBindingV3 schema and atomic SQLite v22 upsert/cleanup; removed Agent POST/DELETE/execution routes; Codex-only snapshot, both role mismatches, permissions, immutable continuation and responsive UI gates |
| TEST-042 | strict removed binding-field rejection, Run without project approval inputs, snapshot/task-context absence, normalized reorder API, ID-only keyboard sortable UI and compact retry-field tests |
| TEST-043 | exact Action Agent inventory/schema/identity/uniqueness/symlink/capability tests; atomic Action pair create/update/delete, stale/rollback/Run-lock tests; immutable prompt/snapshot/permissions and responsive Action Workspace tests |
| TEST-044 | EventStormingService.test.ts, EventStorming.integration.test.ts, eventStorming.test.ts, eventStormingUI.test.tsx, workspaceNavigation.test.tsx, orchestrationInvalidations.test.tsx and desktop/narrow browser QA |
| TEST-045 | Historical six-workspace editor-only component tests, strict preview removal search and 1440x900/390x844 browser QA |
| TEST-046 | UserStoryService/approval/API, ProjectPersistence, Overview API, default project/archive integrity, Story/Markdown/navigation UI tests, unchanged runtime and Event Storming suites, desktop/narrow browser QA |

| ID | Evidenssi |
| --- | --- |
| EVID-028 | initiative ESAO-evid-003–005/007 plus final runtime occurrence result |
| EVID-029 | initiative ESAO-evid-004/006/007/009 plus final occurrence result |
| EVID-030 | initiative ESAO-evid-004/006/007/009 plus final continuation result |
| EVID-031 | initiative ESAO-evid-008/009 plus canonical browser evidence |
| EVID-032 | final cutover command log, release/install/startup evidence and removal gate |
| EVID-033 | Markdown/Loop Engineering UI tests, historical `LESAF-evid-001`–`009`, current `LTD-evid-001`–`005` and browser evidence |
| EVID-034 | Historical paired daemon transaction, restart and security evidence |
| EVID-035 | fixed Agent TOML and Codex-only readiness/dispatch evidence |
| EVID-036 | Feedback/Refinement v2 strict boundary evidence |
| EVID-037 | final strict cutover, Run Evidence and packaged startup evidence |
| EVID-038 | checkout-local-daemon initiative transaction and lifecycle command log |
| EVID-039 | ADR-040 TOML/schema/persistence/API/planner/runtime/UI command log and immutable snapshot assertions |
| EVID-040 | Historical ADR-040 full repository, desktop/narrow browser and fresh SQLite v22 packaged startup evidence |
| EVID-041 | ADR-040 refinement/continuation, full repository and responsive browser evidence |
| EVID-042 | ADR-041 schema/planner/context/API/UI tests plus arc42, cutover, design, lint, build and full-suite command log |
| EVID-043 | ADR-042 TOMLs, Project Config v25, Root Snapshot v20, SQLite v23, repository/API/runtime/UI tests and final validation/startup command log |
| EVID-044 | Event Storming verification record in initiatives/event-storming-workspace/EVIDENCE.md |
| EVID-045 | ADR-047 six-workspace red-to-green component evidence, strict removal search, responsive browser QA and final repository gates |
| EVID-046 | [Four project views verification](initiatives/four-project-views/EVIDENCE.md) |

## ADR-recordit ja nykyisen domainin kattavuus

[Siirtokartoitus](ADR-CONTENT-MAP.md) kattaa alkuperäiset ADR:t ja Event Stormingin taulut. Uudet vaatimukset ovat luonnoksia; vanha evidenssi ei automaattisesti todista niiden jokaista kriteeriä.

| Tarina | Tarkistusten omistaja | Evidenssi |
| --- | --- | --- |
| [54625950-26fb-46fe-90e3-f4cf31084368](../user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md) — overview | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [837f8ecb-c3e7-46d5-a8a4-9521f37542e4](../user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md) — action | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [9b094976-5840-4764-8c2d-9a42559a09d6](../user-stories/9b094976-5840-4764-8c2d-9a42559a09d6.md) — approval | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [9def77e6-89c3-4ef3-b295-89323c592807](../user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md) — feedback | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [a172e384-43eb-4fb3-95ca-9d42ab52a5f7](../user-stories/a172e384-43eb-4fb3-95ca-9d42ab52a5f7.md) — evidence | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [b87320a0-3e7c-4a59-b120-4fa7e3d95b7c](../user-stories/b87320a0-3e7c-4a59-b120-4fa7e3d95b7c.md) — environment | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [cc322abc-96e2-41ef-93f8-1b5aba633995](../user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md) — refinement | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [ff255f3a-5748-42da-904c-311cc9ff9c43](../user-stories/ff255f3a-5748-42da-904c-311cc9ff9c43.md) — critic | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027201](../user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md) — execution | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027202](../user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md) — lifecycle | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027203](../user-stories/aae46173-ec52-44d0-8fa6-e80353027203.md) — distribution | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027204](../user-stories/aae46173-ec52-44d0-8fa6-e80353027204.md) — storm | ADR-parseri, API, ADR-kortit ja projektisisällön tarkistukset | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027205](../user-stories/aae46173-ec52-44d0-8fa6-e80353027205.md) — adr | ADR-parseri, API, ADR-kortit ja projektisisällön tarkistukset | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027206](../user-stories/aae46173-ec52-44d0-8fa6-e80353027206.md) — security | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
| [aae46173-ec52-44d0-8fa6-e80353027207](../user-stories/aae46173-ec52-44d0-8fa6-e80353027207.md) — method | Nykyiset runtime-, project-, security- ja lifecycle-testit; kriteerikohtaiset aukot pidetään avoimina | [Tämän muutoksen tarkistukset](initiatives/adr-records-event-storming/EVIDENCE.md); ei tarinan hyväksyntää |
