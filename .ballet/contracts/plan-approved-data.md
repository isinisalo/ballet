---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: plan-approved-data
  version: 1
spec:
  name: Plan approved data
  description: Data carried by an approved implementation plan event.
  kind: event-data
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - approvalStatus
      - goal
      - acceptanceCriteria
    properties:
      approvalStatus:
        type: string
        enum:
          - approved
      goal:
        type: string
        minLength: 1
      acceptanceCriteria:
        type: array
        items:
          type: string
      constraints:
        type: array
        items:
          type: string
  examples:
    - approvalStatus: approved
      goal: Add contract-driven routing.
      acceptanceCriteria:
        - Runtime validates mapped operation input.
      constraints: []
---

Contract for externally published approved plan facts.
