---
id: arc42-section-03
title: Context and scope
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - context
  - interfaces
arc42Section: 3
---

# 3. Context and scope

## Purpose

Define Ballet's system boundary, users and external interfaces.

## Status

The context reflects the implemented checkout-local architecture.

## Business context

Ballet helps a project owner and delivery team define, execute and inspect repeatable agent workflows in one Git checkout. It does not provide accounts, a remote daemon, a shared control plane or automatic integration of Run results.

| External actor/system | Interaction | Boundary |
| --- | --- | --- |
| Project owner/operator | Configures project resources, starts Runs, answers human gates and inspects evidence through the browser/CLI. | Human retains decision and external-write authority. |
| Git checkout | Supplies version-controlled source, Goals, ADRs, arc42 docs, instructions, skills, Loop config and theme. | Active checkout is not mutated by Node execution. |
| Codex CLI | Executes selected Node compositions. | Provider credentials and ambient context remain provider-owned. |
| GitHub Copilot CLI | Alternative provider through the same adapter boundary. | No automatic provider fallback. |
| Git/GitHub/CI/CD | Supplies local history and, only when authorized, remote release/deploy evidence. | Remote writes require explicit human permission. |
| macOS/launchd | Hosts the checkout-specific background service. | Current distribution scope is macOS. |

## Technical context

The React SPA calls an Express loopback API. The backend loads repository resources, snapshots reachable automation into a Root Run, creates a Git worktree, queues provider executions and persists runtime facts in checkout-local SQLite. Provider adapters receive the exact composed prompt and strict output schema; only validated canonical outcomes can affect State or control flow.

## Out of scope

Centralized project management, account/authentication services, cloud-hosted Ballet runtime, automatic merge/push and non-project workflow defaults are outside the system boundary.

## Canonical sources

`README.md`, goal-001, goal-003, goal-005, goal-008 and ADR-001/005/006/008/009.

## Relevant decisions

`adr-001`, `adr-005`, `adr-006`, `adr-008`, `adr-009`.

## Evidence

The local API, CLI lifecycle, provider adapter and worktree tests cover the implemented interfaces.

## Open questions

- No external interface expansion is approved.

## Next review basis

Review when a new actor, provider, operating system or remote integration enters scope.
