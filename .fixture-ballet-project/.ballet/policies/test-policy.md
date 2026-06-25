---
apiVersion: ballet.dev/v1
kind: RoutingPolicy
metadata:
  id: test-policy
spec:
  name: Route ADR events
  description: Route ADR-created events to the reviewer operation.
  active: true
  consumes:
    eventType: adr.created
  when:
    path: /event/data/severity
    op: eq
    value: low
  dispatch:
    operation:
      id: reviewer/review-adr
      version: 1
  input:
    object:
      severity:
        from: /event/data/severity
      subject:
        from: /event/subject
        default: fixture
  priority: 10
  selection:
    mode: fanout
  onInvalidInput: skip
---

Route ADR-created events to the reviewer.
