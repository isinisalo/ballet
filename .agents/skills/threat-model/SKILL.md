---
name: threat-model
description: Derive a reviewable threat model from accepted data/privacy, autonomy, environment, architecture, and behavior sources. Use after domain and C4 artifacts exist, when trust boundaries or data flows change, or before blueprint, staging, and release security gates.
---

# Threat Model

Read `../_shared/blueprint-governance.md` and `../_shared/artifact-catalog.md` first.

## Authoritative inputs

Use the verified source snapshot, accepted security/data/privacy/autonomy/environment sources, and validated domain/C4/quality artifacts. Treat generic security advice as a check prompt, not project authority.

## Allowed tools

Use local reads, `rg`, YAML and data-flow analysis, and read-only Git. Write only `threat_model` at the catalog path. Use no live probing, credentials, network, cloud, or destructive security tools.

## Procedure

1. Inventory source-backed assets, actors, entry points, data flows, and trust boundaries.
2. Enumerate applicable STRIDE/other threats without asserting unapproved architecture.
3. Trace each threat to affected elements and accepted sources.
4. Derive mitigation and verification only where sources and architecture support them.
5. Mark missing retention, identity, authorization, secret, abuse, or environment decisions as gaps.
6. Write and validate the threat model.

## Output schema

Write kind `threat_model` with `assets`, `trust_boundaries`, and `threats`, including source refs, mitigation, verification, and residual risk.

## Checks and evidence

Report uncovered assets/flows, missing policy inputs, threat counts/severity, artifact path/hash, and structural and semantic check results.

## Approval boundaries

Do not run attacks, access secrets/data, change security controls, or choose a risk acceptance on behalf of a human.

## Stop conditions

Stop on unknown trust boundaries, missing sensitive-data policy, unowned high/critical residual risk, or required external testing authority.

## Retry and concurrency limits

Follow the shared limits. Permit parallel read-only category review; merge findings through one writer.
