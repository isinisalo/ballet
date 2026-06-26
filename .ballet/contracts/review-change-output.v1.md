---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: review-change-output
  version: 1
spec:
  name: Review change output
  description: Review output with domain decision under result.
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
        additionalProperties: false
        required:
          - decision
          - findings
        properties:
          decision:
            type: string
            enum:
              - approved
              - changes_requested
          findings:
            type: array
            items:
              type: string
      evidence:
        type: object
        additionalProperties: false
        properties:
          checks:
            type: array
            items:
              type: object
              additionalProperties: true
  examples:
    - status: completed
      summary: Review completed.
      result:
        decision: approved
        findings: []
      evidence:
        checks:
          - name: review
            status: passed
---

Output contract shared by review operations.
