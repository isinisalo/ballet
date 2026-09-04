---
id: arc42-section-09
title: Arkkitehtuuripäätökset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-04'
version: 36
tags: [arc42, decisions]
arc42Section: 9
---

# 9. Arkkitehtuuripäätökset

| ADR | Status | Aktiivinen päätös |
| --- | --- | --- |
| [adr-034](../adr/adr-034-validation-led-environment-state-action-orchestration.md) | accepted | Environment -> State -> Action, Validation-led loop, strict versions, human-gated Critic/Refinement and immutable continuation |
| [adr-035](../adr/adr-035-markdown-agents-paired-daemon-and-run-evidence.md) | accepted | Markdown authoring, Agent project truth, paired daemon execution binding, resource-only Refinement and Run Evidence |
| [adr-037](../adr/adr-037-checkout-local-daemon.md) | accepted | Supersedes ADR-035 Computer/pairing/remote execution with one checkout-local daemon while retaining Markdown Agents and Run Evidence |
| [adr-038](../adr/adr-038-action-role-execution-bindings.md) | accepted | Action selects versioned role resources plus machine-local Action-role execution bindings; State closure is superseded by ADR-041 |
| [adr-039](../adr/adr-039-action-shared-provider-policy.md) | superseded | Historical shared provider/policy binding, superseded by Codex-only Action binding v3 |
| [adr-040](../adr/adr-040-codex-only-fixed-governance-agents.md) | accepted | Two fixed read-only Codex Agent TOMLs, Codex-only daemon and model/reasoning-only Action bindings |
| [adr-041](../adr/adr-041-instruction-directed-project-context-and-sortable-ordering.md) | accepted | Project documents are instruction/Skill-directed and ordering is edited only with compact ID-only sortable lists |
| [adr-042](../adr/adr-042-action-specific-codex-agents.md) | accepted | Every Action owns distinct Validation/Work TOMLs; removes shared role instruction and machine-local Action execution binding truths |
| [adr-036](../adr/adr-036-loop-engineering-space-and-action-flow-projections.md) | superseded | Historical top-to-bottom State and left-to-right Action projection, superseded by ADR-043 |
| [adr-043](../adr/adr-043-compact-horizontal-state-canvas.md) | superseded | Historical horizontal-State/vertical-Action planet projection and retained Action flow, superseded by ADR-044 |
| [adr-044](../adr/adr-044-three-level-dagre-loop-canvas.md) | superseded | Introduced the three-level Dagre tree; node-label, spacing and edge presentation superseded by ADR-045 |
| [adr-045](../adr/adr-045-spacious-concise-floating-loop-tree.md) | accepted | Spacious concise State -> Action -> Agents tree with visible selected branch and lightweight right-to-left floating curves |

ADR-034:n, ADR-035:n, ADR-037:n, ADR-038:n, ADR-039:n, ADR-040:n, ADR-041:n, ADR-042:n, ADR-043:n, ADR-044:n ja ADR-045:n supersession-listat määrittävät, mitkä aiemmat päätökset tai niiden osat ovat historiallisia. Tässä indeksissä ei ylläpidetä rinnakkaista päätöstekstiä.
