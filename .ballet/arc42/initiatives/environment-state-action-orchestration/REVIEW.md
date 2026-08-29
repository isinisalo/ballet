---
id: environment-state-action-orchestration-review
title: Environment State Action orchestration initiative review
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 7
tags: [arc42, initiative, review, conformance]
---

# Environment State Action orchestration REVIEW

## Verdict

Accepted locally and merge-ready. The baseline-to-HEAD review found no unresolved critical finding. Every high/medium target, security, recovery and authoring finding was corrected with executable regression evidence. All 13 Use Cases, five priority-1 quality scenarios, strict removal, canonical project/fixture, local release/install/startup and the complete responsive browser matrix pass. No compatibility path, migration, alias, dual write or external write was introduced.

## Findings and resolutions

| Severity | Finding | Resolution | Verification |
| --- | --- | --- | --- |
| high | launchd readiness was gated by provider discovery and its 20-second readiness window was below observed launchd scheduling latency | control plane/recovery start independently, provider discovery continues asynchronously, run preflight remains fail closed and the bounded readiness window is 60 seconds | repeated `make latest`, launchd health/status and packaged missing-provider smoke |
| high | restart could strand claimed tasks, persisted terminals or pre-Product finalization | durable task/agent terminal reconciliation and finalization claim/retry were added; DB completion precedes successful worktree cleanup | restart tests for queued, persisted terminal and failed finalization |
| high | provider failures consumed semantic retries; Work output and human-input lifecycle were too broad | provider failure atomically blocks with Feedback without retry consumption; Work is only `completed | needs_input`; exact Agent revision resumes the same attempt | runtime failure, 0/3 retry and durable waiting/resume tests |
| high | provider child processes inherited ambient secrets and managed Git could run hooks | explicit child-environment allowlist and `core.hooksPath=/dev/null` on internal Git operations | `processProbe.test.ts`, `gitProcess.test.ts` |
| high | network-capable agents could reach the loopback human approval boundary | mutations now require same-loopback Origin and same-origin fetch-site; Copilot local network remains denied; trusted actor stays server-owned | missing/forged Origin API cases and provider policy tests |
| high | Critic/Refinement recovery, cross-run ownership and concurrent apply had race windows | governance startup reconciliation, server-derived Product owner, target ownership checks and exact-once pre-write Refinement claim | governance restart/API ownership and concurrent apply tests |
| high | snapshots/continuations/Product projections omitted or under-invalidated accepted context | snapshot includes only referenced approved Use Cases; seed identity is checked; safe-import hash covers Direction/profiles/capabilities/permissions/resources; Product facts include ordered statuses, attempts, evidence, Feedback, Use Case revisions and lineage | planner, persistence, continuation and Product tests |
| high | Use Case approval revision/content binding and UI confirmation could drift | approval carries monotonic revision and expected semantic hash; Markdown semantic edits return to draft; unsaved drafts disable approval | domain/project/API/component tests |
| high | canonical authoring and governance UI were incomplete or misleading | State/Action create/delete, Direction status, deep-link selection, dirty protection, stale-409 refresh, SSE state, exact diff, immutable Critic ownership and mobile controls were implemented | configure/governance/routing/navigation suites and browser matrix |
| medium | strict-cut scan covered only active source roots | gate now scans 477 source, active-doc, project, fixture and governance files with path/status-based historical/rejection allowlist | `npm run validate:cutover` |
| medium | dependency audit reported transitive advisories | lockfile-only transitive refresh | `npm ci`; `npm audit --audit-level=low` reports 0 vulnerabilities |

## Quality verdicts

| QS | Evidence | Verdict |
| --- | --- | --- |
| QS-028 | EVID-028, ESAO-evid-012 | passed: approved closure, unique order/priority, no bypass, Validation-first, exact retry math, durable waiting/restart/cancel |
| QS-029 | EVID-029, ESAO-evid-012 | passed: atomic Feedback, disabled/DST-aware non-overlapping Critic, proposal-only agent and human exact-once approval |
| QS-030 | EVID-030, ESAO-evid-012 | passed: read-only exact proposal, safe paths/preimages/impact, one local commit, immutable continuation and factual Product Snapshot |
| QS-031 | EVID-031, ESAO-evid-012 | passed: nine canonical views at both fixed viewports, page overflow 0, usable mobile navigation/dialog/diff and keyboard focus |
| QS-032 | EVID-032, ESAO-evid-012 | passed: exact versions, 477-file removal gate, full build, local artifact/install/startup/stop |

## Strict cut and allowlist

Active source, config, tests, UI routes and canonical docs contain none of the removed control-domain or temporary namespace semantics. Historical matches are permitted only in:

- superseded Goal/ADR Markdown whose frontmatter says `status: superseded`;
- older initiative history and this initiative's `AUDIT.md`, `CUTOVER-MANIFEST.md`, historical `EVIDENCE.md` and `PLAN.md`;
- strict rejection/guard tests that prove old config versions and removed labels fail.

There is no allowlist for canonical Project Config, active runtime/API/frontend, README, ARCHITECTURE, DESIGN, active arc42 sections, releases, instructions or Skills.

## Browser and accessibility review

The locally installed production bundle passed Direction, Use Cases, Environment, Action editor, Run retry, blocked Feedback, Critic approval, Refinement diff and Product Snapshot at both 1440×900 and 390×844. Every page measured `documentElement.clientWidth === scrollWidth`; status remained unclipped; narrow core controls stayed visible. The mobile navigation Sheet was keyboard usable, the approval dialog fit the viewport and focused its acknowledgment control, and the exact diff owned internal horizontal scrolling.

## Release/startup and authority review

`make latest` produced and locally installed `ballet_0.1.0_darwin_arm64.tar.gz`, SHA-256 `be65207f4dba24da94acfe8222d4fede2c890790ef0b2a63178757d3e7ff3612`. Packaged fresh-state smoke and installed launchd restart/status passed; final `ballet stop` left the service unloaded. Fake-provider completion/block/restart cases prove runtime behavior without credentials or external network. No merge, push, release publication, deploy or external-service write occurred.

## Known limitations and handoff

No Target Contract violation remains. A real-provider occurrence is optional future operational evidence and was deliberately excluded from deterministic acceptance. Rollback before any separately authorized external write is branch discard or checkout of pre-cutover commit `13d9c8d93acb56d569613aa7aa1bd5027317cce1` plus archive/removal of incompatible local v16 state; there is no down migration.
