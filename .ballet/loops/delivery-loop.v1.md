---
apiVersion: ballet.dev/v1
kind: LoopDefinition
metadata:
  id: delivery-loop
  version: 1
spec:
  name: Delivery loop
  description: Sequential delivery chain from approved plan through implementation and reviews.
  active: true
  entryEventTypes:
    - plan.approved.v1
  terminalEventTypes:
    - delivery.completed.v1
    - delivery.aborted.v1
  routingPolicyIds:
    - on_plan_approved_then_start_developer_agent_run
    - on_change_implemented_then_start_architecture_reviewer_agent_run
    - on_change_implemented_then_start_qa_verification_reviewer_agent_run
  emissionPolicyIds:
    - emit-change-implemented
    - emit-architecture-review-approved
    - emit-architecture-review-changes-requested
    - emit-qa-review-approved
    - emit-qa-review-changes-requested
  limits:
    maxHops: 30
    maxRuns: 50
    maxIterationsPerStep: 5
    deadlineSeconds: 7200
  onLimitExceeded:
    eventType: delivery.aborted.v1
---

Design-time Loop Engineering grouping for the delivery workflow.
