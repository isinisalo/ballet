---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: reviewer-input
  version: 1
spec:
  name: Reviewer input
  description: Fixture reviewer input.
  kind: agent-input
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - severity
      - subject
    properties:
      severity:
        type: string
      subject:
        type: string
  examples:
    - severity: low
      subject: fixture
---

Reviewer operation input contract.
