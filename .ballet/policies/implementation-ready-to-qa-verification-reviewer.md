---
id: implementation-ready-to-qa-verification-reviewer
name: Implementation ready to QA verification reviewer
description: Route completed implementation events to the QA verification reviewer.
active: true
match:
  eventTypes:
    - implementation.ready.v1
  projectId: "*"
  source: agentd
  payload:
    artifacts.git_sha:
      operator: exists
action:
  type: start_agent_run
  targetAgentId: qa-verification-reviewer
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---

Routes implementation-ready events to QA verification review. The runtime fans this out alongside any other matching review policies.
