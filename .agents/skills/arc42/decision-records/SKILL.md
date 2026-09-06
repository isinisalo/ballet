---
name: decision-records
description: Maintain current architecture decisions using the canonical ballet-adr record and explicit human authority.
---

# Decision records

1. Read [ballet-adr](../../ballet-adr/SKILL.md). It exclusively owns the ADR format: title, Decision and Scope, without frontmatter or extra sections. Write the title and values in Finnish; retain the literal Decision and Scope field names.
2. Record only a currently accepted architecture decision. Keep proposals and unresolved choices in the relevant initiative or Event Storming hotspot until the human decides; an agent cannot grant acceptance.
3. Preserve an existing decision ID when updating its currently accepted scope. Allocate a new ID after the highest current number when a distinct accepted decision needs a record.
4. Update or delete a decision when it is superseded under the human's authorization. Keep obsolete history in Git, never in the active ADR collection.
5. Put functional behavior and acceptance criteria in User Stories, process/domain evidence in Event Storming, and visual/interaction rules in DESIGN.md. Preserve source traceability in arc42; do not duplicate these as ADR context, rationale, alternatives, consequences, status or review sections.
6. Update the current decision index and active references, validate exact record structure and source links, and report actual checks. Existing historical evidence retains its original revision and results.
