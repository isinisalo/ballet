---
apiVersion: ballet.dev/v1
kind: AgentOperation
metadata:
  id: qa-verification-reviewer/verify-change
  version: 1
spec:
  name: Verify change evidence
  description: Review an implemented change for verification coverage and evidence quality.
  active: true
  agentId: qa-verification-reviewer
  instructions: |
    Review the mapped implementation evidence for test coverage and acceptance criteria risk.
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

QA verification review operation.
