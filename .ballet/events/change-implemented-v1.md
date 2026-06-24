---
id: change-implemented-v1
name: Change implemented
description: Developer agent completed an implementation with required validation evidence.
active: true
eventType: change.implemented.v1
source: agentd
tags:
  - delivery
producers:
  - agentRole: developer-agent
    outcomes:
      - ready
    requires:
      gitCommitExists: true
      requiredChecksPassed: true
payloadExample:
  agent_role: developer-agent
  outcome: ready
  summary: Change is implemented.
  artifacts:
    git_sha: "<commit-sha>"
    changed_files:
      - backend/runtime-db.ts
  checks:
    - name: unit-tests
      status: passed
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---

Published by `agentd` only after a `developer-agent` run returns `outcome=ready`, references an existing git commit, and has no failed required checks.
