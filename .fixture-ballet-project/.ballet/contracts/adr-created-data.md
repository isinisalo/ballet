---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: adr-created-data
  version: 1
spec:
  name: ADR created data
  description: Fixture ADR created event data.
  kind: event-data
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - severity
    properties:
      severity:
        type: string
  examples:
    - severity: low
---

ADR created event data contract.
