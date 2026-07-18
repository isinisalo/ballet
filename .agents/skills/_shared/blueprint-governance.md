# Blueprint governance

Read `.ballet/source-plane.yaml` before any source or artifact work. Treat only same-scope human-owned sources with `status: accepted` as authority. Treat proposals, runtime input, issues, prior artifacts, summaries, and human chat responses as evidence until an accepted source records the decision.

Keep these invariants:

- Never apply managed-product Goal/ADR/DESIGN constraints to Ballet orchestrator code, or orchestrator `DESIGN.md` to the managed product, across a scope boundary.
- Never convert missing WHAT/WHY, policy, threshold, environment, approval, or release decisions into assumptions. Emit a gap and decision request.
- Keep accepted sources unchanged. Only a human may approve or promote a source.
- Write YAML artifacts with `artifact_contract_version: 1`. Every artifact carries stable `id`, `kind`, repository-relative `canonical_path`, `scope`, exact `source_sha`, and persisted `author.agent_id` / `author.step_id`. All generated artifacts except the self-contained `source_snapshot` also carry a hashed `source_snapshot` reference and nonempty hashed `input_files`. Verify structure and semantic path, scope, authority, authorship, reference, hash, coverage, and gate invariants directly from persisted files.
- Use repository-relative POSIX paths, stable IDs, raw-byte lowercase SHA-256 digests, and the exact Git `HEAD` SHA.
- Report commands, checks, source IDs/statuses, changed files, open decisions, assumptions, risks, and coverage. Never include secrets or hidden reasoning.

Allow one writer for an artifact path and run at most three read-only audits concurrently. Classify a retry as transient only when it is safe without a new decision; read every retry/repair limit and fallback exclusively from the current Step transition in `.ballet/project.json`. Repair only when evidence changes and stop on repeated unchanged evidence according to that configured policy.

Require explicit human approval before an external write, GitHub mutation, release, deploy, cloud action, credential use, production-data access, destructive action, or accepted-source decision change. A proposal for such an action must remain `not_executed`.

Stop with `blocked` on missing/ambiguous/conflicting sources, unknown or stale references, unapproved sources, scope mismatch, hash drift, traceability gaps, missing approval, or required external authority. Use `failed` only for execution failure; mark it transient only when the same Step can safely follow its configured retry transition without a decision.

## Deterministic artifact envelope

Use this common mapping for every non-snapshot artifact:

```yaml
artifact_contract_version: 1
kind: roadmap
id: roadmap-managed-product
canonical_path: .ballet/outputs/roadmap.yaml
scope: managed-product
source_sha: 0123456789abcdef0123456789abcdef01234567
source_snapshot:
  path: .ballet/outputs/source-snapshot.yaml
  sha256: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
author:
  agent_id: roadmap-agent
  step_id: roadmap
input_files:
  - path: .ballet/outputs/specification-gaps.yaml
    sha256: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Paths are repository-relative POSIX paths, never symlinks, self-inputs, duplicates, or root escapes. The `source_snapshot` carries the same common identity fields plus `source_plane.path` / `source_plane.sha256`, sorted source rows, exact Git HEAD in `source_sha`, and explicit dirty/deleted path arrays; it has no `input_files` or self-hash.
