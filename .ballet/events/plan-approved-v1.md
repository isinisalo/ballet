---
id: plan-approved-v1
name: Plan approved
description: An implementation plan was approved and can be routed to the developer agent.
active: true
eventType: plan.approved.v1
source: "*"
tags:
  - delivery
producers: []
payloadExample:
  work_item_id: work-1
  plan_id: plan-1
  summary: Approved change plan.
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---

Published when a plan is approved outside the agent runtime. The policy owns routing this fact to `developer-agent`.
