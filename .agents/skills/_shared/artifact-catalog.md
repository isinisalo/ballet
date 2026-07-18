# Artifact catalog

Use these canonical paths and verify each artifact's documented fields, scope, authority, references, hashes, coverage, and gate evidence directly from the persisted YAML and its inputs:

| Kind | Path |
| --- | --- |
| `source_snapshot` | `.ballet/outputs/source-snapshot.yaml` |
| `specification_gaps` | `.ballet/outputs/specification-gaps.yaml` |
| `decision_requests` | `.ballet/outputs/decision-requests.yaml` |
| `roadmap` | `.ballet/outputs/roadmap.yaml` |
| `domain_map` | `.ballet/outputs/domain-map.yaml` |
| `c4_context_container` | `.ballet/outputs/c4-context-container.yaml` |
| `quality_scenarios` | `.ballet/outputs/quality-scenarios.yaml` |
| `threat_model` | `.ballet/outputs/threat-model.yaml` |
| `ux_information_architecture` | `.ballet/outputs/ux-information-architecture.yaml` |
| `test_strategy` | `.ballet/outputs/test-strategy.yaml` |
| `traceability_manifest` | `.ballet/outputs/traceability-manifest.yaml` |
| `blueprint_review` | `.ballet/outputs/blueprint-review.yaml` |
| `blueprint_gate_packet` | `.ballet/outputs/blueprint-gate-packet.yaml` |
| `milestone_manifest` | `.ballet/outputs/milestones/<milestone-id>/milestone-manifest.yaml` |
| `issue_drafts` | `.ballet/outputs/milestones/<milestone-id>/issue-drafts.yaml` |
| `implementation_plan` | `.ballet/outputs/milestones/<milestone-id>/implementation-plan.yaml` |
| `test_plan` | `.ballet/outputs/milestones/<milestone-id>/test-plan.yaml` |
| `acceptance_evidence` | `.ballet/outputs/milestones/<milestone-id>/acceptance-evidence.yaml` |
| `staging_report` | `.ballet/outputs/milestones/<milestone-id>/staging-report.yaml` |
| `release_manifest` | `.ballet/outputs/releases/<version>/release-manifest.yaml` |

Keep narrative strings in Finnish and technical IDs, paths, commands, hashes, and enum values unchanged. Use a Markdown companion only as a rendering; never let it replace the YAML authority/evidence contract.

## Artifact generation boundary

Write only the canonical artifact owned by the current Step. Before writing, verify that its inputs belong to the current source snapshot and selected scope. If an existing output is stale, ambiguous, or bound to another snapshot, stop and report the exact path and mismatch; do not overwrite, delete, or move it. Never use a recursive deletion, glob, unresolved variable, or broad move as artifact maintenance.

When a gap audit has no decision requests, do not create an empty `decision_requests` artifact. If a stale conditional artifact already exists, report it as blocking evidence and request explicit, path-specific cleanup authority. Perform no source, Git, network, or external mutation as part of artifact verification.
