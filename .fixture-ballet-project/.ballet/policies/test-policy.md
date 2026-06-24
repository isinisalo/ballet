---
id: test-policy
name: Route ADR events
active: true
priority: 10
eventTypes:
  - adr.created
tags:
  - architecture
source: architect
targetAgentId: reviewer
payloadMetadata:
  severity: low
---

Route ADR-created events to the reviewer.
