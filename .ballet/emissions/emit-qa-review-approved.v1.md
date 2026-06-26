---
apiVersion: ballet.dev/v1
kind: EmissionPolicy
metadata:
  id: emit-qa-review-approved
  version: 1
spec:
  name: Emit QA review approved
  description: Emit QA approval when verification decision is approved.
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
        value: approved
  emissions:
    - slot: approved
      eventType: qa.review-approved.v1
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
        template: emission:{{/run/id}}:emit-qa-review-approved:approved
---

Explicit QA approval emission.
