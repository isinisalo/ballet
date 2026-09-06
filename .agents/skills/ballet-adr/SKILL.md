---
name: ballet-adr
description: Create and update Architecture Decision Records, ADRs.
---

# ADR

Every active ADR MUST use exactly this structure:

```text
[ADR-001: <short title>]
Decision: <what has been decided>
Scope: <where the decision applies and, when useful, where it does not apply>
```

Example:

```text
[ADR-001: DynamoDB]
Decision: DynamoDB is the primary persistent database for the backend.
Scope: Applies to runtime data. Does not apply to analytics or local developer state.
```

If an ADR contains anything else, it is invalid.

ADRs describe only currently accepted architecture decisions. Update or delete existing ADRs when decisions change. Do not keep superseded, deprecated, rejected, proposed, historical, rationale, alternatives, consequences, or status information in ADRs.
