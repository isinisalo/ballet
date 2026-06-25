---
apiVersion: ballet.dev/v1
kind: RoutingPolicy
metadata:
  id: on_change_implemented_then_start_qa_verification_reviewer_agent_run
spec:
  name: on_change_implemented_start_qa_verify_change_operation
  description: Route implemented change facts to the QA verification operation.
  active: true
  consumes:
    eventType: change.implemented.v1
  dispatch:
    operation:
      id: qa-verification-reviewer/verify-change
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

Maps implementation data into QA verification input.
