---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: delivery-terminal-data
  version: 1
spec:
  name: Delivery terminal data
  description: Terminal delivery event data.
  kind: event-data
  active: true
  schema:
    type: object
    additionalProperties: false
    properties:
      reason:
        type: string
  examples:
    - reason: completed
---

Event data contract for delivery terminal facts.
