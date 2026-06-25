---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: test-event
spec:
  name: Test event
  description: Fixture event definition for markdown loading tests.
  active: true
  eventType: adr.created
  source: architect
  tags:
    - architecture
  dataContract:
    id: adr-created-data
    version: 1
  examples:
    - severity: low
---

An ADR event definition emitted by the architect agent.
