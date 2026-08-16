---
name: decision-records
description: Propose and maintain architecture decision records without changing accepted decisions silently. Use when a choice is important, risky, expensive, hard to reverse or contentious.
---

# Decision records

1. Confirm that the issue is architecture-significant and not already decided by an accepted ADR.
2. Record context, decision drivers/QS, considered options, proposed decision, consequences, evidence and review trigger.
3. Allocate the next free ADR ID without overwriting a gap unless that gap is the next free identifier.
4. Create proposals as `draft` or `review`; only explicit human approval may set `accepted`.
5. Never edit the semantic decision of an accepted ADR. Create a superseding ADR and update section 9 when a decision changes.
6. Link affected Goal/QS/CON/BB/RISK IDs and report the required human decision.
