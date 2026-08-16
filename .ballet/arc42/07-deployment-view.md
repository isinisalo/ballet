---
id: arc42-section-07
title: Deployment view
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 1
tags:
  - arc42
  - deployment
arc42Section: 7
---

# 7. Deployment view

## Purpose

Describe the technical environments and mappings relevant to safety, isolation and distribution.

## Status

The local deployment is implemented; published-release evidence depends on a separately authorized release.

| ID | Environment and mapping | Interfaces | Quality/risk |
| --- | --- | --- | --- |
| DEP-001 | One macOS Git checkout hosts one loopback Ballet Node process, React assets and `.git/ballet/state.sqlite`; launchd maintains lifecycle. | Browser on `127.0.0.1`, local filesystem and provider CLIs. | Checkout isolation; no remote control plane. |
| DEP-002 | Each Root Run executes in `.git/ballet/worktrees/<root-run-id>` on a dedicated Run branch while runtime facts remain in checkout-local SQLite. | Git worktree, provider process and runtime stores. | Active checkout protection and inspectable failure state. |
| DEP-003 | Release bundles package Node, compiled backend/CLI, frontend and native dependencies for macOS arm64/x64; verification precedes activation. | GitHub release/attestation and optional Homebrew only after authorization. | Supply-chain integrity; external service dependency. |

## Canonical sources

`README.md`, ADR-001, ADR-006, ADR-007 and ADR-009; source under `backend/cli/`, `backend/execution/git/`, `scripts/` and `packaging/`.

## Relevant decisions

`adr-001`, `adr-006`, `adr-007`, `adr-008`, `adr-009`, `adr-011`.

## Evidence

Lifecycle, worktree, SQLite and packaged smoke tests provide local evidence. No release publication is claimed by this migration.

## Open questions

- No production hosting or non-macOS deployment is approved.

## Next review basis

Review when the supported OS, process topology, runtime store or release distribution path changes.
