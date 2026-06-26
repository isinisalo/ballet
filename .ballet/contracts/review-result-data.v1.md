---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: review-result-data
  version: 1
spec:
  name: Review result data
  description: Data emitted for explicit review result events.
  kind: event-data
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - decision
      - summary
      - findings
    properties:
      decision:
        type: string
        enum:
          - approved
          - changes_requested
      summary:
        type: string
      findings:
        type: array
        items:
          type: string
      gitSha:
        type: string
  examples:
    - decision: approved
      summary: Review completed.
      findings: []
      gitSha: "<commit-sha>"
---

Event data contract for review result facts.
