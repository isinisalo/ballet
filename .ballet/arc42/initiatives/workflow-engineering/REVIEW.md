---
id: workflow-engineering-review
title: Workflow Engineering hard cut review
status: draft
createdAt: '2026-08-20'
updatedAt: '2026-08-20'
version: 2
tags:
  - arc42
  - initiative
  - workflow-engineering
  - review
---

# Workflow Engineering REVIEW

## Status

Draft; the strict-v12 implementation and ADR-021 canvas correction pass technical evidence, while human visual acceptance is pending.

## Summary

The bounded change replaces only the selected-Loop composite model and Loop Engineering route/name with strict-v12 Workflow Engineering. Graph Engineering and the accepted State, Orchestrator, Loop Module, and project/platform boundaries remain.

## Fact

- Domain, runtime, persistence, API, UI, repository data and tests have been converted locally.
- WFE-EVID-001–007 are passed in named local suites, earlier browser QA and repository gates.
- WFE-EVID-009 passed for the corrected Job-only canvas, full suite, final gates and desktop/narrow browser QA.
- WFE-EVID-008 is pending.

## Decision

No initiative acceptance decision is recorded. `adr-020` and `adr-021` authorize the architecture and implementation boundary, not release/deploy or a final visual verdict.

## Assumption and hypothesis review

- WFE-ASSUMPTION-001 is supported by the generated v12 config, v2 packages and packaged release smoke.
- WFE-HYPOTHESIS-001 remains technically supported.
- WFE-HYPOTHESIS-002 is technically supported by WFE-EVID-009 and still requires the WFE-EVID-008 human visual verdict before it can be accepted.

## Findings

- **WFE-FINDING-001:** Technical suites and desktop/narrow browser QA pass, but they do not replace human interpretation evidence.
- **WFE-FINDING-002:** A pre-existing schema v7 database requires operator archive/remediation and is intentionally not migrated automatically.
- **WFE-FINDING-003:** Earlier browser evidence rendered Validation and result endpoints as separate canvas nodes; ADR-021 intentionally supersedes only that projection and requires new evidence.

## QS verdict

| QS | Criterion | Evidence | Verdict |
| --- | --- | --- | --- |
| QS-015 | Strict contracts, runtime, persistence, UI, legacy removal, gates and visual QA | WFE-EVID-001–008 | pending |

## Trace and risk updates

`TRACEABILITY.md` links goal-013 / REQ-013 → QS-015 → adr-020 / adr-021 / CON-008 → BB/RT → TEST-015 → EVID-015. RISK-014 remains open until WFE-EVID-008 and WFE-EVID-009 pass.

## Open questions

- Project owner: does the desktop/narrow Workflow canvas communicate the Job-owned Validation responsibility and terminal PASS/FAIL routes without separate Validation/result nodes or reliance on color alone?

## Handoff

- Current status: draft, technical implementation and final gates passed.
- Next Loop: evaluation / human acceptance.
- Requested outcome: explicit WFE-EVID-008 verdict.
- Next approved action: present desktop/narrow evidence for project-owner review; no external write is authorized.

## Next review basis

Accept only after every priority-1 QS-015 evidence item is passed or an explicit human decision records the impact of an exception.
