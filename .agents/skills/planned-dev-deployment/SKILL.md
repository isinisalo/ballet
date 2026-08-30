---
name: planned-dev-deployment
description: Define and execute a dev deployment only from the current arc42 Deployment View, with exact authorization, health, rollback and acceptance evidence.
---

# Planned dev deployment

The target is architecture output, not workflow configuration.

1. **Deployment View authoring:** derive the dev environment from accepted context, building blocks, runtime scenarios and constraints. Section 7 must name the exact target, deployable artifact and version identity, prerequisites, commands, health criteria, rollback and external-write boundary. Do not hardcode a provider or target elsewhere.
2. **Deploy to dev:** compare the current environment and artifact with section 7. Require exact action-scoped human authorization immediately before any external write. Execute the documented plan once; `maxRetries: 0` prevents an automatic second deployment. Stop on drift, partial state or ambiguous rollback.
3. **Acceptance test:** identify the exact deployed version and run the in-scope scenarios from section 10 against that environment. Record passed, failed, blocked and pending evidence separately.
4. Redact credentials and sensitive values from commands, events and evidence. A missing target, command, version, authorization, health result or rollback makes the outcome `needs_input` or blocked, never inferred success.
5. Deployment, acceptance and rollback evidence must reference the exact arc42 plan revision used.
