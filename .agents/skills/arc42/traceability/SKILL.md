---
name: traceability
description: Build and validate stable architecture trace chains. Use when work connects Goals or requirements to quality scenarios, decisions, concepts, building blocks, runtime/deployment scenarios, tests, monitors and evidence.
---

# Traceability

1. Start from an existing Goal/REQ ID and one measurable QS ID.
2. Link the smallest relevant ADR/CON, BB and RT/DEP IDs; create no placeholder ID without a canonical definition.
3. Name an executable test or monitor and a concrete evidence ID with status.
4. Mark missing links `pending` or as an Open question; never infer passed evidence.
5. Update `TRACEABILITY.md` only for relationships/status and keep full content in its owner document.
6. Run `npm run validate:arc42` and include exact unresolved IDs in the outcome.
