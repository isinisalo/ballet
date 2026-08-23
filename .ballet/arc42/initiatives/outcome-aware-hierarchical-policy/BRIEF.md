---
id: outcome-aware-hierarchical-policy-brief
title: Outcome-aware Hierarchical Policy BRIEF
status: draft
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - brief
  - ssp
---

# Outcome-aware Hierarchical Policy BRIEF

## Purpose and authority

Implement Portti A of `goal-017` / `REQ-017`: outcome-aware `ssp_v2` at Graph and GraphNode scopes alongside explicit `agent_v1`, without fallback. The user authorized implementation on 2026-08-23; calibrated priors/costs, pilot execution and Portti B remain human gates.

## Fact and decision

- **Fact OHP-F-001:** accepted ADR-026 has Graph-only `ssp_v1`; local routing is agent-owned.
- **Decision OHP-D-001:** implement scoped `P(outcome,nextState | state,action)`, canonical actual-state projection, proper-policy readiness and immutable evidence as proposed in ADR-028.
- **Assumption OHP-A-001:** a domain owner can calibrate the first model; not yet verified.
- **Hypothesis OHP-H-001:** semantic model misses improve calibration and routing inspectability; pilot pending.

## Scope

Config v16, Decision/Capability Model v2, Module v5, Snapshot v9, SQLite v12, role/envelope/composition/execution contract bumps, global/local policy runtime, observations, scoped preview/Run UI and automated tests.

## Non-goals

Agent-router removal, invented priors/costs, online learning, external writes and a claimed end-to-end pilot.

## Quality and acceptance

Priority-1 `QS-022` covers scoped proper-policy safety. Priority-1 `QS-023` covers projector-owned actual state and four model-miss classes. Portti A requires full repository gates; pilot evidence stays pending.

## Open questions

- **OHP-OQ-001:** which bounded features, probability rows and scalar costs will the project owner approve for the five-node pilot?
- **OHP-OQ-002:** when does the project owner explicitly authorize Portti B?

