---
apiVersion: ballet.dev/v1
kind: EventDefinition
metadata:
  id: change-implemented-v1
spec:
  name: Change implemented
  description: Developer operation completed an implementation with validation evidence.
  active: true
  eventType: change.implemented.v1
  source: agentd
  tags:
    - delivery
  dataContract:
    id: change-implemented-data
    version: 1
  examples:
    - summary: Change is implemented.
      gitSha: "<commit-sha>"
      changedFiles:
        - backend/runtime-db.ts
      checks:
        - name: npm test
          status: passed
---

Published by an explicit emission policy after developer output validates and technical gates pass.
