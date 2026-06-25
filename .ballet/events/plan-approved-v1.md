---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: plan-approved-v1
spec:
  name: Plan approved
  description: An implementation plan was approved and can be routed to the developer operation.
  active: true
  eventType: plan.approved.v1
  source: "*"
  tags:
    - delivery
  dataContract:
    id: plan-approved-data
    version: 1
  examples:
    - approvalStatus: approved
      goal: Add contract-driven routing.
      acceptanceCriteria:
        - Runtime validates mapped operation input.
      constraints: []
---

Published when a plan is approved outside the agent runtime.
