---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: implement-change-input
  version: 1
spec:
  name: Implement change input
  description: Strict input for developer implementation operations.
  kind: agent-input
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - workItemId
      - goal
      - acceptanceCriteria
      - constraints
    properties:
      workItemId:
        type: string
        minLength: 1
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
    - workItemId: work-1
      goal: Add contract-driven routing.
      acceptanceCriteria:
        - Runtime validates mapped operation input.
      constraints: []
---

Input contract for the developer implementation operation.
