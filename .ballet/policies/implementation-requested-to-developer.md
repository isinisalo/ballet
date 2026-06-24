---
id: implementation-requested-to-developer
name: Implementation requested to developer
description: Route implementation request events to the developer agent.
active: true
match:
  eventTypes:
    - implementation.requested.v1
  projectId: "*"
  source: "*"
action:
  type: start_agent_run
  targetAgentId: developer-agent
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---

Routes implementation request events to the developer agent. The runtime creates a durable `agent_run`; the agent returns a structured outcome, and the runtime maps that outcome to a domain event after validation.
