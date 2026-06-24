---
id: on_change_implemented_then_start_architecture_reviewer_agent_run
name: on_change_implemented_then_start_architecture_reviewer_agent_run
description: Route implemented change facts to the architecture reviewer.
active: true
match:
  eventTypes:
    - change.implemented.v1
  projectId: "*"
  source: agentd
  payload:
    artifacts.git_sha:
      operator: exists
action:
  type: start_agent_run
  targetAgentId: architecture-reviewer
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---

Routes implemented change facts to the architecture reviewer. The runtime fans this out alongside any other matching review policies.
