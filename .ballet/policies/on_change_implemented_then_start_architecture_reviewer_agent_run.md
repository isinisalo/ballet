---
apiVersion: ballet.dev/v1
kind: RoutingPolicy
metadata:
  id: on_change_implemented_then_start_architecture_reviewer_agent_run
spec:
  name: on_change_implemented_start_architecture_review_operation
  description: Route implemented change facts to the architecture review operation.
  active: true
  consumes:
    eventType: change.implemented.v1
  dispatch:
    operation:
      id: architecture-reviewer/review-change
      version: 1
  input:
    object:
      workItemId:
        from: /event/subject
      summary:
        from: /event/data/summary
      gitSha:
        from: /event/data/gitSha
      changedFiles:
        from: /event/data/changedFiles
      checks:
        from: /event/data/checks
        default: []
  selection:
    mode: fanout
  onInvalidInput: skip
---

Maps implementation data into architecture review input.
