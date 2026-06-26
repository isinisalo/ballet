---
apiVersion: ballet.dev/v1
kind: EmissionPolicy
metadata:
  id: emit-change-implemented
  version: 1
spec:
  name: Emit change implemented
  description: Emit change.implemented.v1 from completed developer output.
  active: true
  observes:
    operation:
      id: developer-agent/implement-change
      version: 1
  when:
    path: /output/status
    op: eq
    value: completed
  gates:
    - type: git_commit_exists
      path: /output/result/gitSha
    - type: no_failed_checks
      path: /output/evidence/checks
  onGateFailure: fail_run
  emissions:
    - slot: implemented
      eventType: change.implemented.v1
      subject:
        from: /input/workItemId
      data:
        object:
          summary:
            from: /output/summary
          gitSha:
            from: /output/result/gitSha
          changedFiles:
            from: /output/result/changedFiles
            default: []
          checks:
            from: /output/evidence/checks
            default: []
      dedupeKey:
        template: emission:{{/run/id}}:emit-change-implemented:implemented
---

Emits the implementation completion fact after independent technical gates pass.
