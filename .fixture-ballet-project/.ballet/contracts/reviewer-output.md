---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: reviewer-output
  version: 1
spec:
  name: Reviewer output
  description: Fixture reviewer output.
  kind: agent-output
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - status
      - summary
    properties:
      status:
        type: string
        enum:
          - completed
          - blocked
          - needs_input
          - failed
      summary:
        type: string
      result:
        type: object
        additionalProperties: true
  examples:
    - status: completed
      summary: Reviewed.
---

Reviewer operation output contract.
