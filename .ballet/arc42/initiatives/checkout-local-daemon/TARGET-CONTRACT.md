---
id: cld-target-contract-001
title: Checkout-local daemon target contract
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [arc42, initiative, contract]
---

# Target contract

- Server owns SQLite v18, queue, managed worktrees, v11 validation, finalization and immutable Run Evidence.
- One checkout-local daemon owns provider readiness and at most one CLI process per provider.
- `AgentExecutionBindingV2` has no Computer, device or runtime backend identity.
- ExecutionSpec v14 plus permission snapshot and server-owned worktree path is the only daemon task envelope.
- `/api/runtimes/local` is the only operator runtime resource; `/api/daemon/*` is loopback-only and bearer-authenticated.
- A claim is atomic and fenced. Queued work survives restart. Claimed work never requeues and lease expiry records one `runtime_lost` failure.
- Config/token material is checkout-specific and mode `0600`; pairing, Keychain, TLS, WebSocket, remote clone and daemon finalization are absent.
