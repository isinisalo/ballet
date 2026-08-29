---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 41
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat edelleen aktiivisen Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `goal-023` / `adr-035` ovat hyväksytty superseding target Markdown-authoringille, Agent/Computer/CLI-sidonnalle, paired daemonille, minimal Feedbackille, resource-only Refinementille ja Run Evidencelle.

Versiomatriisi on Project Config v21, Root Snapshot v14, Task Envelope / role outcome v11, prompt composition v12, ExecutionSpec v13 ja SQLite v17; Feedback/Critic/Refinement ovat v2 ja Agent/daemon binding sekä Run Evidence v1. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-29 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 33 files / 272 tests including paired daemon claims/fencing, checkout hashes, workspace permissions, restart, provider failure, approvals, refinement races and security boundaries |
| Canonical responsive UI | passed; all 13 main routes plus selected entities at 1440×900 and 390×844, page overflow 0, SSE live, no console warning/error and visible narrow controls at least 40 px |
| Canonical default project/resources/docs/diagram | passed locally; 13 approved Use Cases, 5 States, 14 Actions, 4 Markdown Agents and complete resource/hash/trace validation |
| Final cross-layer conformance | accepted; strict v21/v17 contract, 552-file strict-cut gate, 0 dependency vulnerabilities and all repository gates green |
| Local package/startup | passed; `make latest`, artifact/install, packaged fresh-state SQLite v17 smoke and healthy launchd service at `127.0.0.1:53321` |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains accepted historical baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is accepted locally with EVID-033–EVID-037 passed. A remote computer was not newly paired and no live provider occurrence was run; those remain operational setup, not hidden acceptance claims. Merge, push, release publication, deploy, scope change or external write requires a new human authorization.
