---
apiVersion: ballet.dev/v1
kind: EmissionPolicy
metadata:
  id: emit-qa-review-changes-requested
  version: 1
spec:
  name: Emit QA review changes requested
  description: Emit QA changes-requested when verification decision requires changes.
  active: true
  observes:
    operation:
      id: qa-verification-reviewer/verify-change
      version: 1
  when:
    all:
      - path: /output/status
        op: eq
        value: completed
      - path: /output/result/decision
        op: eq
        value: changes_requested
  emissions:
    - slot: changes-requested
      eventType: qa.review-changes-requested.v1
      subject:
        from: /input/workItemId
      data:
        object:
          decision:
            from: /output/result/decision
          summary:
            from: /output/summary
          findings:
            from: /output/result/findings
            default: []
          gitSha:
            from: /input/gitSha
      dedupeKey:
        template: emission:{{/run/id}}:emit-qa-review-changes-requested:changes-requested
---

Explicit QA changes-requested emission.
