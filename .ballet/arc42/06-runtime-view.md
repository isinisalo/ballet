---
id: arc42-section-06
title: Ajonaikainen näkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 25
tags: [arc42, runtime]
arc42Section: 6
---

# 6. Ajonaikainen näkymä

| ID | Skenaario | Atominen/immutable raja |
| --- | --- | --- |
| RT-026 | Environment Run | v22 State-owned closure preflight -> v16 snapshot -> local daemon lease -> lowest order/priority -> Validation precheck -> optional Work -> Validation postwork -> done/retry/blocked -> gated next State -> Run Evidence |
| RT-027 | Feedback and Critic | schedule claim -> immutable read set -> pending proposal -> human decision; hyväksytty Critic proposal ja Feedback syntyvät samassa transaktiossa |
| RT-028 | Refinement and continuation | read-only exact proposal -> human hash/revision approval -> allowlisted managed-worktree apply -> one commit -> immutable continuation link/run |
| RT-029 | Markdown and Loop authoring | load canonical Markdown/config -> edit/preview -> strict server validation -> save revision/hash -> invalidate affected approval |
| RT-030 | Role daemon execution | resolve Action-role and governance Agent bindings -> checkout/config/capability preflight -> fenced lease -> CLI dispatch -> idempotent terminal callback -> root transition |
| RT-031 | Feedback refinement and Run Evidence | `{category, comment}` -> trusted provenance -> resource-only exact proposal -> human approval/apply -> continuation; terminal success -> immutable Run Evidence |
| RT-032 | Checkout-local daemon task | ready discriminated binding -> atomic claim/fencing -> ExecutionSpec v15 in server-owned worktree -> lease renew/events -> raw terminal callback -> server v11 validation/finalization; expiry -> one runtime_lost failure |

## RT-026 rules

Precheck accepts only `done | delegate | blocked`; Work only its strict role outcome; postwork only `done | retry | blocked`. First Work plus `maxRetries` additional attempts is the total semantic budget. Technical provider failure follows its own terminal handling and never consumes a semantic retry invisibly. Exhaustion creates blocked+Feedback atomically. A later State cannot be selected while any earlier Action is not done.

## Recovery and idempotency

Every dispatch is persisted before enqueue, has a causal key and reconciles from SQLite after restart. An unclaimed queued task remains eligible; a claimed task is never requeued and lease expiry records one terminal failure. Cancellation makes queued work ineligible. Approval commands include expected revision/hash and decide once. Parent runs and snapshots are never mutated by continuation.
