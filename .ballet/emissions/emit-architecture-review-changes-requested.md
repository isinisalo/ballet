---
apiVersion: ballet.dev/v1
kind: EmissionPolicy
metadata:
  id: emit-architecture-review-changes-requested
  version: 1
spec:
  name: Emit architecture review changes requested
  description: Emit architecture changes-requested when review decision requires changes.
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
        value: changes_requested
  emissions:
    - slot: changes-requested
      eventType: architecture.review-changes-requested.v1
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
        template: emission:{{/run/id}}:emit-architecture-review-changes-requested:changes-requested
---

Explicit architecture changes-requested emission.
