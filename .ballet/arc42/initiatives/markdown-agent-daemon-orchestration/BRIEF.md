---
id: mado-brief-001
title: Markdown Agent daemon orchestration brief
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [arc42, initiative, markdown, daemon]
---

# Markdown Agent daemon orchestration BRIEF

## Status and purpose

Initiative `markdown-agent-daemon-orchestration` implements `goal-023` / `REQ-023` under `adr-035`. The project owner approved the WHAT/WHY and local implementation on 2026-08-29.

## Facts and decision

- **Fact MADO-fact-001:** canonical v20/v16 uses form-heavy Configure workspaces, ExecutionProfiles, checkout-local daemon and Product Snapshot.
- **Fact MADO-fact-002:** commit `13d9c8d93acb56d569613aa7aa1bd5027317cce1` contains the requested Markdown workbench and project submenu interaction.
- **Fact MADO-fact-003:** commit `8ff3420e` contains the requested Agents, Computers and paired-daemon control-plane baseline.
- **Decision MADO-decision-001:** adapt those UX/infrastructure patterns to the current Environment/Validation model with the strict version matrix in TARGET-CONTRACT.

## Scope

Markdown authoring, restored Agent entity and machine binding, paired daemon/control plane, Codex/Copilot CLI readiness, Loop Engineering Environment canvas, minimal Feedback, resource-only Refinement, Run Evidence, canonical routes and strict legacy removal.

## Non-goals

No Graph/Reward-MDP restoration, multi-device Run, code refinement, Product entity, deploy, migration, compatibility reader, route alias, dual-write, push, merge or release.

## Stakeholders and quality

The project owner needs a simple authoring workflow and explicit execution computer. Operators need factual availability and restart-safe work. Reviewers need exact immutable evidence. QS-033–QS-037 are priority 1 and TEST/EVID-033–037 are the acceptance chain.

## Open questions

None. The project owner resolved daemon scope, Product semantics and Refinement allowlist explicitly.
