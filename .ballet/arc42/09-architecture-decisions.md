---
id: arc42-section-09
title: Arkkitehtuuripäätökset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 30
tags: [arc42, decisions]
arc42Section: 9
---

# 9. Arkkitehtuuripäätökset

| ADR | Status | Aktiivinen päätös |
| --- | --- | --- |
| [adr-034](../adr/adr-034-validation-led-environment-state-action-orchestration.md) | accepted | Environment -> State -> Action, Validation-led loop, strict versions, human-gated Critic/Refinement and immutable continuation |
| [adr-035](../adr/adr-035-markdown-agents-paired-daemon-and-run-evidence.md) | accepted | Markdown authoring, Agent project truth, paired daemon execution binding, resource-only Refinement and Run Evidence |
| [adr-037](../adr/adr-037-checkout-local-daemon.md) | accepted | Supersedes ADR-035 Computer/pairing/remote execution with one checkout-local daemon while retaining Markdown Agents and Run Evidence |
| [adr-038](../adr/adr-038-action-role-execution-bindings.md) | accepted | Action inherits its State Use Case closure and selects versioned role resources plus machine-local Action-role execution bindings |
| [adr-036](../adr/adr-036-loop-engineering-space-and-action-flow-projections.md) | accepted | shared ordered State/Action space canvas and Validation-led Action workflow projection without runtime ownership |

ADR-034:n, ADR-035:n, ADR-037:n ja ADR-038:n supersession-listat määrittävät, mitkä aiemmat päätökset tai niiden osat ovat historiallisia. ADR-036 tarkentaa vain aktiivisen UI-projektion. Tässä indeksissä ei ylläpidetä rinnakkaista päätöstekstiä.
