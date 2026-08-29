---
id: environment-state-action-orchestration-review
title: Environment State Action orchestration initiative review
status: draft
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 3
tags:
  - arc42
  - initiative
  - review
---

# Environment State Action orchestration REVIEW

## Current status

Initiative `environment-state-action-orchestration` has an accepted WHAT/WHY, architecture decision and target contract. Isolated phases 02–07 now provide strict contracts, v16 persistence, Validation-led runtime, governance/refinement workflows and `/api/vnext`; the active canonical API/UI remains strict v19 until phase 09. Final EVID-028..032 verdicts remain pending.

## Facts, decisions and findings

- **Fact:** `AUDIT.md` and `CUTOVER-MANIFEST.md` are committed baseline evidence in `116322db`.
- **Decision:** `goal-022` and `adr-034` accept Environment → State → Action, Validation-led execution, human approval and strict version/removal semantics.
- **Decision:** phases 02–08 may use only the bounded isolated vNext exception; phase 09 removes both legacy and temporary names.
- **Finding:** semantic replacement is required; a GraphNode→State rename would preserve the wrong control owner.
- **Finding:** Critic-readable artifact lifetime and shared Skill reverse impact are mandatory phase 06 design controls.
- **Evidence:** commits `e494cab9` and `21ba436b` implement the isolated runtime and governance boundaries; ESAO-evid-007 records the project repository, service composition and typed HTTP boundary added in phase 07.
- **Finding resolved in transition:** successful Run worktrees are cleaned, then a bounded detached read-only worktree is materialized from the exact Product commit for Critic/Refinement capture and removed afterward.
- **Assumption:** pre-production machine state may be archived/removed rather than migrated, as explicitly authorized.
- **Conformance result:** the bounded review classified README's “Module v7 has no local policy” sentence as documentation drift and corrected it to the executable v7 contract. After that local retry, no unresolved conflict remains between goal-022, adr-034, Target Contract, transition scope, stable trace IDs and active-v19 status; final validator results are recorded in ESAO-evid-002.

## Open questions

No open decision blocks phase 02. Any request to change ordering, approval ownership, allowed refinement paths, standalone run boundary, strict cut or external-write authority returns `needs_input`.

## Per-QS verdict

| QS | Criterion owner | Evidence | Verdict |
| --- | --- | --- | --- |
| QS-028 | ordered Validation-led runtime | EVID-028 | isolated backend/API passed; canonical/provider evidence pending |
| QS-029 | Feedback/Critic/human approval | EVID-029 | isolated backend/API passed; UI/real occurrence pending |
| QS-030 | refinement/continuation immutability | EVID-030 | isolated Git/API passed; UI/real occurrence pending |
| QS-031 | responsive accessible UI | EVID-031 | pending implementation |
| QS-032 | strict cut/removal/release | EVID-032 | pending implementation |

Architecture validation accepts the contract as ESAO-evid-002 but cannot turn these target implementation verdicts green.

## Handoff

- Initiative: `environment-state-action-orchestration`.
- Status: accepted architecture; implementation pending.
- Completed Node goal: phases 01–07 through the isolated vNext backend/API transition boundary.
- Next one prepared action: phase 08 isolated `/vnext` Direction, Environment, Run, Feedback, Critic, Refinement and Product Snapshot UI.
- Stop condition: any scope-changing decision or any merge/push/release/deploy/external write requires new human input; canonical switching remains reserved for phase 09.
