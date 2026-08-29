---
name: sqlite-transactional-invariants
description: Implement and verify SQLite transactions, constraints, idempotency and restart-safe state transitions.
category: persistence
---

# SQLite transactional invariants

1. Name the durable facts and invariant that must change together before writing SQL.
2. Use one transaction for causally inseparable facts, including blocked Action plus Feedback and approval plus its effect.
3. Encode uniqueness, monotonic revision and impossible transitions with constraints or guarded updates where practical.
4. Make callbacks and recovery idempotent with stable causal keys; test duplicate and crash-boundary behavior.
5. Keep external processes outside ambiguous database transactions and define a recoverable handoff state around them.
6. Test rollback with an injected failure and inspect persisted rows after reopen, not only in-memory return values.
