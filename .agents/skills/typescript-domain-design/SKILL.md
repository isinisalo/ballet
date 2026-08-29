---
name: typescript-domain-design
description: Design strict reusable TypeScript domain types, schemas and pure invariants with one source of truth.
category: engineering
---

# TypeScript domain design

1. Start from the accepted domain terms and owner layer; do not introduce aliases for removed or parallel concepts.
2. Keep pure types and derivations in `shared/`; keep I/O, process and persistence concerns behind backend boundaries.
3. Use strict discriminated unions and reject unknown fields at every external boundary.
4. Represent one fact once. Derive projections such as `done` and `blocked` instead of persisting duplicate booleans.
5. Preserve exhaustive handling and add negative tests for invalid states, dangling references and version mismatches.
6. Report the affected contract, public exports and exact tests used as evidence.
