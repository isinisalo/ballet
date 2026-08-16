---
name: document-maintenance
description: Maintain Ballet arc42 Markdown canonically and without duplication. Use when a Node updates arc42 sections, indexes, status, glossary, migration pointers or initiative documents.
---

# Document maintenance

1. Resolve the content owner before editing: Goal for WHAT/WHY, ADR for a decision, arc42 section for an architecture view, DESIGN.md for the UI system, or initiative artifact for bounded delivery.
2. Classify new statements as Fact, Decision, Assumption, Hypothesis, Finding or Open question. Never promote an unsupported statement to Fact or Decision.
3. Update the smallest canonical location and link from indexes; do not copy full source content.
4. Preserve stable IDs and status. Supersede obsolete duplicates with a pointer after all active links move.
5. Update `updatedAt` and version only for semantic content changes. Avoid churn when evidence is unchanged.
6. Validate local links and report changed paths, stable IDs and checks for the State patch evidence.
