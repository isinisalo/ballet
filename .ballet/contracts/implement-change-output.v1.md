---
apiVersion: ballet.dev/v1
kind: ContractDefinition
metadata:
  id: implement-change-output
  version: 1
spec:
  name: Implement change output
  description: Operation output for completed development work.
  kind: agent-output
  active: true
  schema:
    type: object
    additionalProperties: false
    required:
      - status
      - summary
    properties:
      status:
        type: string
        enum:
          - completed
          - blocked
          - needs_input
          - failed
      summary:
        type: string
        minLength: 1
      result:
        type: object
        additionalProperties: false
        properties:
          gitSha:
            type: string
          changedFiles:
            type: array
            items:
              type: string
      evidence:
        type: object
        additionalProperties: false
        properties:
          checks:
            type: array
            items:
              type: object
              additionalProperties: false
              required:
                - name
                - status
              properties:
                name:
                  type: string
                status:
                  type: string
                  enum:
                    - passed
                    - failed
                    - skipped
                details:
                  type: string
          artifacts:
            type: object
            additionalProperties: true
  examples:
    - status: completed
      summary: Change is implemented.
      result:
        gitSha: "<commit-sha>"
        changedFiles:
          - backend/runtime-db.ts
      evidence:
        checks:
          - name: npm test
            status: passed
---

Output contract for developer operation completion.
