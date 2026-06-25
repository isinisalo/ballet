---
apiVersion: ballet.dev/v1
kind: AgentOperation
metadata:
  id: reviewer/review-adr
  version: 1
spec:
  name: Review ADR
  description: Review an ADR-created event.
  active: true
  agentId: reviewer
  instructions: Review the mapped ADR data.
  inputContract:
    id: reviewer-input
    version: 1
  outputContract:
    id: reviewer-output
    version: 1
  emissionRequired: false
---

Review ADR operation.
