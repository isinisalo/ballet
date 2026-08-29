---
id: arc42-section-06
title: Ajonaikainen näkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 23
tags: [arc42, runtime]
arc42Section: 6
---

# 6. Ajonaikainen näkymä

| ID | Skenaario | Atominen/immutable raja |
| --- | --- | --- |
| RT-026 | Environment Run | v21 preflight -> v14 snapshot -> same-device daemon lease -> lowest order/priority -> Validation precheck -> optional Work -> Validation postwork -> done/retry/blocked -> gated next State -> Run Evidence |
| RT-027 | Feedback and Critic | schedule claim -> immutable read set -> pending proposal -> human decision; hyväksytty Critic proposal ja Feedback syntyvät samassa transaktiossa |
| RT-028 | Refinement and continuation | read-only exact proposal -> human hash/revision approval -> allowlisted managed-worktree apply -> one commit -> immutable continuation link/run |
| RT-029 | Markdown and Loop authoring | load canonical Markdown/config -> edit/preview -> strict server validation -> save revision/hash -> invalidate affected approval |
| RT-030 | Agent daemon execution | resolve all Agent bindings -> same-device/checkout/config/capability preflight -> fenced lease -> CLI dispatch -> idempotent terminal callback -> root transition |
| RT-031 | Feedback refinement and Run Evidence | `{category, comment}` -> trusted provenance -> resource-only exact proposal -> human approval/apply -> continuation; terminal success -> immutable Run Evidence |

## RT-026 rules

Precheck accepts only `done | delegate | blocked`; Work only its strict role outcome; postwork only `done | retry | blocked`. First Work plus `maxRetries` additional attempts is the total semantic budget. Technical provider failure follows its own terminal handling and never consumes a semantic retry invisibly. Exhaustion creates blocked+Feedback atomically. A later State cannot be selected while any earlier Action is not done.

## Recovery and idempotency

Every dispatch is persisted before enqueue, has a causal key and reconciles from SQLite after restart. Cancellation makes queued work ineligible. Approval commands include expected revision/hash and decide once. Parent runs and snapshots are never mutated by continuation.
