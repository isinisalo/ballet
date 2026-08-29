---
id: mado-evidence-001
title: Markdown Agent daemon orchestration evidence
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 2
tags: [arc42, initiative, evidence]
---

# Markdown Agent daemon orchestration EVIDENCE

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| MADO-evid-001 | REQ-023 / QS-033–037 | approved goal, ADR, target contract and strict implementation review | `goal-023`, `adr-035`, initiative files, commits `4ffefbbb` and `bf25ec95` | passed | 2026-08-29 local repository | merge, push, publication and deploy were not authorized or performed |
| EVID-033 | QS-033 | Markdown authoring, restored information architecture and responsive accessibility | `MarkdownWorkbench`, routing/component tests and in-app browser QA | passed: exact old-workbench structure, 13 canonical routes, 0 px page overflow, no console warning/error and no visible narrow control below 40 px | 2026-08-29; 1440×900 and 390×844 | browser QA used the local packaged service and canonical project data |
| EVID-034 | QS-034 | paired daemon protocol, exact checkout snapshot, claim/lease/fencing, permissions and root finalization | `ControlPlaneService.test.ts`, `GitWorkspaceManager.test.ts`, `LeaseAwareJobRunner.test.ts`, `WorkspacePermissionPolicy.test.ts` | passed in deterministic local integration fixtures; terminal/finalization replay is idempotent and claims are fenced | 2026-08-29; full Vitest suite | no remote computer was newly paired and no live provider task was dispatched during this repository acceptance |
| EVID-035 | QS-035 | Agent Markdown/binding contract and Codex/Copilot adapters | Agent UI/API tests, daemon adapter tests and local CLI probes | passed; Codex CLI `0.150.1` and GitHub Copilot CLI `1.0.81` are discoverable | 2026-08-29 local host | CLI authentication and a billable/live provider occurrence were not exercised |
| EVID-036 | QS-036 | minimal Feedback boundary and resource-only Refinement | API/governance/security tests; `.ballet/agents/**`, `.ballet/instructions/**`, `.agents/skills/**` allowlist | passed; request owns only category/comment and all repository writes remain approval/hash/preimage gated | 2026-08-29; full Vitest suite | no proposal was approved or applied to external state |
| EVID-037 | QS-037 | strict v21/v17 removal, package, install, startup and full repository acceptance | `npm ci`; 33 files/272 tests; lint; build; arc42/design/cutover validators; `make latest`; `ballet status`; `git diff --check` | passed; 0 dependency vulnerabilities, 552-file removal gate, fresh packaged SQLite v17 smoke and healthy launchd service at `127.0.0.1:53321` | 2026-08-29 local checkout | old v16 state DB and WAL/SHM companions were intentionally removed; no migration exists |
