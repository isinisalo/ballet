---
id: on_plan_approved_then_start_developer_agent_run
name: on_plan_approved_then_start_developer_agent_run
description: Start development work when an approved plan fact is published.
active: true
match:
  eventTypes:
    - plan.approved.v1
  projectId: "*"
  source: "*"
action:
  type: start_agent_run
  targetAgentId: developer-agent
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---

When a plan is approved, this policy creates a durable developer-agent `agent_run`. The event remains a domain fact; the policy owns the runtime action.
