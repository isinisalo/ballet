---
apiVersion: ballet.dev/v1
kind: AgentOperation
metadata:
  id: developer-agent/implement-change
  version: 1
spec:
  name: Implement change
  description: Implement an approved plan as the smallest safe repository change.
  active: true
  agentId: developer-agent
  instructions: |
    Implement the requested change described by the input object.
    Do not publish Ballet events or choose event types.
    Return completed only after validation evidence is available.
  inputContract:
    id: implement-change-input
    version: 1
  outputContract:
    id: implement-change-output
    version: 1
  emissionRequired: true
---

Developer implementation operation.
