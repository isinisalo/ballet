---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: qa-review-approved-v1
spec:
  name: QA review approved
  description: QA verification reviewer approved an implemented change.
  active: true
  eventType: qa.review-approved.v1
  source: agentd
  tags:
    - delivery
    - review
  dataContract:
    id: review-result-data
    version: 1
  examples:
    - decision: approved
      summary: QA review completed.
      findings: []
      gitSha: "<commit-sha>"
---

Explicit QA approval fact.
