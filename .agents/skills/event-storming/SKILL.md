---
name: event-storming
description: Explore a bounded domain through Big Picture, Process Modeling and Software Design Event Storming artifacts. Use for collaborative domain discovery, not as a substitute for stakeholder knowledge or accepted architecture.
---

# Event Storming

Use the current Action name and input to select exactly one level. Read the preceding artifact when the Action declares one.

1. **Big Picture Exploration:** arrange past-tense Domain Events chronologically; expose pivotal events, actors, systems, values, opportunities, hotspots, parallel flows and scope boundaries. Preserve stakeholder language and label assumptions or missing expertise.
2. **Process Modeling:** select bounded processes from the Big Picture and connect Commands, Actors, Policies, Read Models and resulting Domain Events. Include alternate and failure paths, bottlenecks and questions that need a domain expert.
3. **Software Design:** derive candidate Aggregates, invariants, bounded contexts and Command/Event/Read Model ownership from the process evidence. Record alternatives and coupling risks. Architecture-significant choices remain proposals in workshop evidence or an initiative until human acceptance; only then record the current decision using ballet-adr.
4. Keep every claim traceable to workshop evidence or an existing project document. Return `needs_input` when missing domain knowledge would otherwise be fabricated.
5. Event Storming informs arc42; it does not replace requirements, interface contracts, deployment design or accepted architecture documentation.

Reference method: https://techtrendsetters.org/p/event-storming

## Repository-owned visual model

The approved Project Event Storming workspace and these Actions share `.ballet/event-storming/model.md`. Read [MODEL.md](MODEL.md) before editing. The YAML frontmatter is EventStormingModelV1; the Markdown body retains supplementary workshop evidence. Preserve note IDs across levels and use independent placements to show the same note on several boards. Never regenerate or reposition unrelated boards. The requested board ID bounds the work; if more than one board fits without explicit selection, ask for bounded input rather than choosing silently.

Work edits only its managed-worktree file, using atomic replacement after validating the entire model. Validation reads the same file and verifies the selected level, references and domain evidence. `npm run validate:arc42` checks the shared schema when the file exists. No narrative copy, SQLite mirror, automatic acceptance or Run gate is introduced. The previous three separate level-artifact paths are replaced.
