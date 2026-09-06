---
id: arc42-section-06
title: Ajonaikainen näkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 31
tags: [arc42, runtime]
arc42Section: 6
---

# 6. Ajonaikainen näkymä

| ID | Skenaario | Atominen/immutable raja |
| --- | --- | --- |
| RT-026 | Environment Run | v26 ordering/Agent/Skill preflight -> v21 snapshot without project-document closure -> local Codex daemon lease -> lowest order/priority -> Validation precheck -> optional Work -> Validation postwork -> done/retry/blocked -> gated next State -> Run Evidence |
| RT-027 | Feedback and Critic | schedule claim -> immutable read set -> pending proposal -> human decision; hyväksytty Critic proposal ja Feedback syntyvät samassa transaktiossa |
| RT-028 | Refinement and continuation | read-only exact proposal -> human hash/revision approval -> allowlisted managed-worktree apply -> one commit -> immutable continuation link/run |
| RT-029 | Markdown and Loop authoring | load source + baseline hash -> edit -> stale notification preserves draft and requires explicit reload -> strict server validation -> save/adopt returned hash -> invalidate affected approval |
| RT-030 | Role daemon execution | resolve Action role selections or fixed Codex Agent -> checkout/config/capability preflight -> fenced lease -> Codex dispatch -> idempotent terminal callback -> root transition |
| RT-031 | Feedback refinement and Run Evidence | `{category, comment}` -> trusted provenance -> resource-only exact proposal -> human approval/apply -> continuation; terminal success -> immutable Run Evidence |
| RT-032 | Checkout-local daemon task | ready Codex capability -> atomic claim/fencing -> ExecutionSpec v18 in server-owned worktree -> lease renew/events -> raw terminal callback -> server v11 validation/finalization; expiry -> one runtime_lost failure |
| RT-033 | Historical Codex-only Action binding | superseded by RT-034; machine-local Action execution binding is removed |
| RT-034 | Action Agent execution | exact Action-Agent inventory -> model/reasoning capability preflight -> freeze TOML definition/hash + Skill closure -> emit Validation/Work `action_agent` specs with TOML instructions; Validation read-only, Work managed-worktree, any mismatch -> zero dispatch |
| RT-035 | Event Storming authoring | read model.md → edit note/placement → debounce or finish gesture → serial optimistic PUT → atomic file replacement → transient invalidation; conflict retains draft; Run lock blocks writes |
| RT-036 | Project authoring and story agreement | Load canonical Markdown → edit with byte baseline → save atomically or retain conflicted draft → explicit human approval checks byte and semantic hashes → persist approver/time/revision in the same story. Semantic edits yield Draft. No project-document or approval step is added to Environment execution. |

## RT-026 rules

Precheck accepts only `done | delegate | blocked`; Work only its strict role outcome; postwork only `done | retry | blocked`. First Work plus `maxRetries` additional attempts is the total semantic budget. Technical provider failure follows its own terminal handling and never consumes a semantic retry invisibly. Exhaustion creates blocked+Feedback atomically. A later State cannot be selected while any earlier Action is not done.

## Recovery and idempotency

Every dispatch is persisted before enqueue, has a causal key and reconciles from SQLite after restart. An unclaimed queued task remains eligible; a claimed task is never requeued and lease expiry records one terminal failure. Cancellation makes queued work ineligible. Approval commands include expected revision/hash and decide once. Parent runs and snapshots are never mutated by continuation.

Browser invalidations share one connection. Opening or reconnecting resynchronizes visible data; replay cursors start afresh so a restarted server cannot strand clients behind an old sequence. Only HTTP 404 means a missing selected entity; operational errors remain visible.
