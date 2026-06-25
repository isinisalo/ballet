---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: change-implemented-data
  version: 1
spec:
  name: Change implemented data
  description: Data emitted after implementation completes.
  kind: event-data
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - summary
      - gitSha
      - changedFiles
      - checks
    properties:
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
    - summary: Change is implemented.
      gitSha: "<commit-sha>"
      changedFiles:
        - backend/runtime-db.ts
      checks:
        - name: npm test
          status: passed
---

Event data contract for implementation completion.
