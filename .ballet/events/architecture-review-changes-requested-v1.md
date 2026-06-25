---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: architecture-review-changes-requested-v1
spec:
  name: Architecture review changes requested
  description: Architecture reviewer requested changes.
  active: true
  eventType: architecture.review-changes-requested.v1
  source: agentd
  tags:
    - delivery
    - review
  dataContract:
    id: review-result-data
    version: 1
  examples:
    - decision: changes_requested
      summary: Architecture review found issues.
      findings:
        - Clarify ownership boundary.
      gitSha: "<commit-sha>"
---

Explicit architecture changes-requested fact.
