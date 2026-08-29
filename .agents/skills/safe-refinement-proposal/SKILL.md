---
name: safe-refinement-proposal
description: Propose exact read-only instruction and Skill refinements with complete hash and impact evidence.
category: governance
---

# Safe refinement proposal

1. Start from immutable Feedback, source Run, Run Evidence and exact base commit; do not write while proposing.
2. Limit changes to the canonical allowlist and reject traversal, symlinks, repository metadata and unrelated source paths.
3. Record each path, operation, exact preimage SHA-256, resulting content SHA-256 and one exact proposal hash.
4. Resolve the complete reverse-reference closure for every changed shared Skill and name all affected Actions.
5. Provide bounded validation commands, expected outcomes and rollback by discarding the managed worktree or proposal.
6. Never approve or apply. Any stale base, preimage, impact or approval mismatch must produce zero repository writes.
