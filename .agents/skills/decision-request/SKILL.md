---
name: decision-request
description: Convert blocking specification gaps or accepted-source conflicts into neutral, human-owned decision requests without inventing WHAT/WHY. Use when source validation or blueprint work finds a missing, ambiguous, conflicting, or unapproved product, policy, architecture, data, autonomy, environment, or release decision.
---

# Decision Request

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the validated source snapshot, accepted same-scope sources, source-validation diagnostics, and observable conflict/gap evidence. Treat proposed options and runtime feedback as non-authoritative.

## Allowed tools

Use local reads, `rg`, YAML tooling, and read-only Git. Write only `specification_gaps` and, when blocking gaps exist, `decision_requests` at catalog paths. Use no network or external writes.

## Procedure

1. Group each missing, conflicting, ambiguous, or unapproved decision into one stable gap ID.
2. Cite facts and affected accepted sources; do not add a preferred decision as fact.
3. Mark material WHAT/WHY and policy gaps blocking.
4. Create one focused request per human decision. Present source-compatible options and consequences; keep recommendation `null` unless accepted policy explicitly selects it.
5. Name the human-owned source paths that must record the resolution.
6. Make `open_decision_refs` exactly match every persisted request ID and verify the artifacts. Return `needs_input` when any blocking request awaits a source update. When no request is needed, create no empty artifact; if a stale canonical request artifact already exists, report its exact path as blocking and request explicit path-specific cleanup authority.

## Output schema

Always write kind `specification_gaps`; every blocking gap and conflict has a matching request ID and reciprocal gap link. Conditionally write kind `decision_requests`; keep every request `awaiting_human`, expose every request in both artifacts' `open_decision_refs`, and keep every external action unexecuted.

## Checks and evidence

Report gap/conflict counts, source refs, requested source updates, structural and semantic check results, and whether blueprint work is blocked.

## Deterministic validation

Run `node .agents/skills/decision-request/scripts/validate.mjs --root <checkout-root> --gaps .ballet/outputs/specification-gaps.yaml --requests .ballet/outputs/decision-requests.yaml` when blocking requests exist. Omit `--requests` only when there are no blocking gaps and no stale conditional request artifact.

## Approval boundaries

Never select an option, edit an accepted source, interpret a gate response as source authority, or approve the request.

## Stop conditions

Stop until a human records and approves the decision in a source and a new source snapshot validates.

## Retry and concurrency limits

Follow the shared limits. Deduplicate equivalent gaps; never create parallel requests for one decision.
