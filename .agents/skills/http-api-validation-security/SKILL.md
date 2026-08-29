---
name: http-api-validation-security
description: Maintain strict local HTTP contracts, trusted actor boundaries and safe bounded API projections.
category: security
---

# HTTP API validation and security

1. Validate path, query and body with strict schemas before calling application services; reject unknown fields and oversized payloads.
2. Preserve loopback, Host, same-origin mutation and content-type checks. Do not derive trusted actor identity from a request body.
3. Keep approval commands operation-specific and bind them to exact revision and content or impact hashes.
4. Return explicit conflict status for stale state and avoid leaking raw prompts, secrets, credentials or unbounded logs.
5. Bound pagination and SSE cursors; preserve factual event ordering and reconnect semantics.
6. Add negative tests for hostile origin, forged actor, stale hash, traversal, symlink and unexpected body fields.
