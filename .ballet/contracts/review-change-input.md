---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: review-change-input
  version: 1
spec:
  name: Review change input
  description: Input for architecture and QA review operations.
  kind: agent-input
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - workItemId
      - summary
      - gitSha
      - changedFiles
      - checks
    properties:
      workItemId:
        type: string
      summary:
        type: string
      gitSha:
        type: string
      changedFiles:
        type: array
        items:
          type: string
      checks:
        type: array
        items:
          type: object
          additionalProperties: true
  examples:
    - workItemId: work-1
      summary: Change is implemented.
      gitSha: "<commit-sha>"
      changedFiles:
        - backend/runtime-db.ts
      checks: []
---

Input contract shared by review operations.
