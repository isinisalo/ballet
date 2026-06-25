---
apiVersion: ballet.dev/v1
kind: AgentOperation
metadata:
  id: architecture-reviewer/review-change
  version: 1
spec:
  name: Review change architecture
  description: Review an implemented change for architecture, contracts, and maintainability.
  active: true
  agentId: architecture-reviewer
  instructions: |
    Review the mapped implementation evidence for architecture risks.
    Put the domain decision under result.decision as approved or changes_requested.
    Do not publish Ballet events or choose event types.
  inputContract:
    id: review-change-input
    version: 1
  outputContract:
    id: review-change-output
    version: 1
  emissionRequired: true
---

Architecture review operation.
