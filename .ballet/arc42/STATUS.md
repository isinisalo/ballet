---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 39
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

`goal-022` / `adr-034` omistavat edelleen aktiivisen Environment -> State -> Action- ja Validation-led-runtime-semanttiikan. `goal-023` / `adr-035` ovat hyväksytty superseding target Markdown-authoringille, Agent/Computer/CLI-sidonnalle, paired daemonille, minimal Feedbackille, resource-only Refinementille ja Run Evidencelle.

Versiomatriisi on Project Config v20, Root Snapshot v13, Task Envelope / role outcome v10, prompt composition v11, ExecutionSpec v12 ja SQLite v16. API ja UI käyttävät vain canonical routeja. Strict removal -gate estää korvatun aktiivikoodin, transitional namespacejen ja compatibility-polkujen palautumisen.

| Evidenssi | Tila 2026-08-29 |
| --- | --- |
| Domain, persistence, runtime, governance and API automated suites | passed; 30 files / 267 tests including restart, provider failure, approvals, refinement races and security boundaries |
| Canonical responsive UI | passed; nine views at both 1440×900 and 390×844, page overflow 0, keyboard-usable Sheet/dialog and internal diff scrolling |
| Canonical default project/resources/docs/diagram | passed locally; 13 approved Use Cases, 5 States, 14 Actions, 4 role profiles and complete resource/hash/trace validation |
| Final cross-layer conformance | accepted; four bounded audits closed, 477-file strict-cut gate, 0 dependency vulnerabilities and all repository gates green |
| Local package/startup | passed; `make latest`, artifact/install, packaged fresh-state smoke, launchd health/restart and clean stop |
| External writes | not authorized and not performed |

Initiative [environment-state-action-orchestration](initiatives/environment-state-action-orchestration/BRIEF.md) remains accepted historical baseline. [markdown-agent-daemon-orchestration](initiatives/markdown-agent-daemon-orchestration/BRIEF.md) is in local implementation; EVID-033–EVID-037 are pending. Merge, push, release publication, deploy, scope change or external write requires a new human authorization.
