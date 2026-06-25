---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: qa-review-changes-requested-v1
spec:
  name: QA review changes requested
  description: QA verification reviewer requested changes.
  active: true
  eventType: qa.review-changes-requested.v1
  source: agentd
  tags:
    - delivery
    - review
  dataContract:
    id: review-result-data
    version: 1
  examples:
    - decision: changes_requested
      summary: QA review found issues.
      findings:
        - Add regression coverage.
      gitSha: "<commit-sha>"
---

Explicit QA changes-requested fact.
