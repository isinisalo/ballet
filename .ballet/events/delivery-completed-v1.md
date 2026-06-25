---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: delivery-completed-v1
spec:
  name: Delivery completed
  description: Terminal delivery loop completion fact.
  active: true
  eventType: delivery.completed.v1
  source: agentd
  tags:
    - delivery
  dataContract:
    id: delivery-terminal-data
    version: 1
  examples:
    - reason: completed
---

Terminal event for delivery loop completion.
