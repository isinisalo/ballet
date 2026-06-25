---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: delivery-aborted-v1
spec:
  name: Delivery aborted
  description: Terminal delivery loop abort fact.
  active: true
  eventType: delivery.aborted.v1
  source: agentd
  tags:
    - delivery
  dataContract:
    id: delivery-terminal-data
    version: 1
  examples:
    - reason: loop limit exceeded
---

Terminal event for aborted delivery loops.
