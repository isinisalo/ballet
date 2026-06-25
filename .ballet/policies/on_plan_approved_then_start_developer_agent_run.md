---
apiVersion: ballet.dev/v1
kind: RoutingPolicy
metadata:
  id: on_plan_approved_then_start_developer_agent_run
spec:
  name: on_plan_approved_start_developer_implement_change_operation
  description: Start implementation when an approved plan fact is published.
  active: true
  consumes:
    eventType: plan.approved.v1
  when:
    path: /event/data/approvalStatus
    op: eq
    value: approved
  dispatch:
    operation:
      id: developer-agent/implement-change
      version: 1
  input:
    object:
      workItemId:
        from: /event/subject
      goal:
        from: /event/data/goal
      acceptanceCriteria:
        from: /event/data/acceptanceCriteria
      constraints:
        from: /event/data/constraints
        default: []
  selection:
    mode: fanout
  onInvalidInput: reject-event
---

Maps approved plan data into developer operation input.
