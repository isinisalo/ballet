---
apiVersion: ballet.dev/v1
kind: EmissionPolicy
metadata:
  id: emit-architecture-review-approved
  version: 1
spec:
  name: Emit architecture review approved
  description: Emit architecture approval when review decision is approved.
  active: true
  observes:
    operation:
      id: architecture-reviewer/review-change
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
      eventType: architecture.review-approved.v1
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
        template: emission:{{/run/id}}:emit-architecture-review-approved:approved
---

Explicit architecture approval emission.
