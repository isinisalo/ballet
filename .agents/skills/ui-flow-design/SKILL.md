---
name: ui-flow-design
description: Derive UX information architecture, user journeys, views, and explicit success/empty/loading/error/permission states from accepted behavior and design sources. Use for managed-project blueprint UX work or flow revisions after source validation, without borrowing a DESIGN source from another scope.
---

# UI Flow Design

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the verified source snapshot, accepted same-scope behavior/capability and DESIGN sources, roadmap, domain map, quality scenarios, and threat model. If the selected scope lacks an accepted DESIGN source, emit a gap instead of using root `DESIGN.md` by default.

## Allowed tools

Use local reads, `rg`, YAML/flow analysis, accessibility checks, and read-only Git. Write only `ux_information_architecture` at the catalog path. Use no image generation, implementation, network, or external writes.

## Procedure

1. Map source-backed actors and outcomes.
2. Derive the shortest complete journeys and navigation hierarchy.
3. Define each view's purpose and required success, empty, loading, error, and permission states where applicable.
4. Trace journeys/views to sources and acceptance criteria.
5. Check responsive/accessibility needs only when accepted sources or quality policies define them; expose missing decisions.
6. Write and validate the artifact.

## Output schema

Write kind `ux_information_architecture` with stable actors, journeys, views, state enums, source refs, and acceptance refs.

## Checks and evidence

Report actor/outcome coverage, unreachable views, missing states, cross-scope design attempts, artifact path/hash, and structural and semantic check results.

## Approval boundaries

Do not invent brand, copy policy, component library, color, typography, workflow, role, or product behavior.

## Stop conditions

Stop when a flow requires an absent behavior, role, policy, acceptance criterion, or same-scope DESIGN decision.

## Retry and concurrency limits

Follow the shared limits. Keep one IA writer and parallelize only read-only journey/state checks.
