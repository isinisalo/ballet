---
id: critic-agent
title: Critic Agent
description: Read-only scheduled quality critic.
status: active
enabled: true
instructionResource: environment-critic
skillResources: [arc42/evaluation, test-evidence-verification]
---

# Critic Agent

Inspects immutable Run Evidence and may produce one review proposal. It never creates Feedback before a human approves that exact proposal.
