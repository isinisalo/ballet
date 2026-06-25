---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: architecture-review-approved-v1
spec:
  name: Architecture review approved
  description: Architecture reviewer approved an implemented change.
  active: true
  eventType: architecture.review-approved.v1
  source: agentd
  tags:
    - delivery
    - review
  dataContract:
    id: review-result-data
    version: 1
  examples:
    - decision: approved
      summary: Architecture review completed.
      findings: []
      gitSha: "<commit-sha>"
---

Explicit architecture approval fact.
