---
id: overview
title: Ballet project overview
---

# Ballet

## Purpose

Ballet is a checkout-local command center for project owners, agent operators and developers who need to turn explicit project intent into inspectable, bounded implementation work. Humans decide what matters and approve consequential changes; Validation examines evidence before and after subordinate Work. The project can be understood and reviewed through ordinary Git diffs.

## Outcomes

- **One understandable project definition.** Purpose, outcomes, scope and shared requirements live here; functional behavior and acceptance criteria live in [User Stories](user-stories/); processes live in Event Storming; decisions and their reasons live in [ADRs](adr/). Every active story has a test/evidence owner in [traceability](arc42/TRACEABILITY.md). Missing active references and duplicate editable sources: zero.
- **Safe, repeatable local work.** Agent writes to the user's active checkout or outside the authorized worktree paths: zero. Unauthorized merge, push, publication, deployment and external service writes: zero. Failed preimage, symlink or traversal checks cause zero project changes.
- **Deterministic and explainable execution.** State and Action dispatch order matches ascending `order` and `priority` in every ordering fixture; a later State receives zero tasks before every Action in preceding States is `done`. Completion and blocking flags are written into Project Config zero times.
- **Durable, inspectable evidence.** Duplicate callbacks and restarts cannot create extra Feedback, Critic occurrences or continuation Runs. A continuation changes its parent's snapshot by zero bytes. Every Run Evidence fact is recomputable from canonical stores and exact commits/artifacts.
- **An accessible operator workspace.** At 1440×900 and 390×844, page-level horizontal overflow, clipped core controls, mobile primary controls below 40 px and color-only status information are zero. Keyboard users can reach every approval. Deep links, back/forward and invalid-selection recovery preserve the same selected entity. [DESIGN.md](../DESIGN.md) owns the visual and interaction contract.
- **A reliable local service.** A fresh server and daemon become ready within 60 seconds; daemon crash recovery takes at most 30 seconds. A leased task that loses its runtime terminates once with `runtime_lost` within 90 seconds and is never requeued. Queued work survives restart. The measurable environments and evidence status are maintained in [quality scenarios](arc42/10-quality-requirements.md).

## Scope

The product includes repository-owned project authoring, an ordered Environment → State → Action definition, separate Action Validation/Work agents and Skills, one Codex CLI daemon per checkout, local queue/leases, runtime facts, managed Git worktrees, Feedback, Critic/Refinement review and immutable continuation lineage. Run Evidence is shown inside its owning terminal Run.

The supported local lifecycle uses macOS/launchd. The platform also executes the unrelated compact fixture with the same primitives. Ballet's own Event Storming, arc42, design, build and deployment procedures belong to project documents and agent instructions, never hardcoded platform branches.

Each service owns exactly one committed Git checkout, with an isolated identity, loopback port and local state; multiple checkouts can operate concurrently. There is no Ballet cloud account or centralized multi-project control plane. Provider installation and authentication remain the provider CLI's responsibility.

Standalone State/Action Runs, freeform execution topology, provider-selected routing, remote/pairing configuration, autonomous human approvals, automatic merge/push/release/deploy, compatibility readers, data migrations, route aliases and dual writes are outside scope. Story approval agrees on requirements; it is neither implementation completion nor passing-test evidence, and is not a Run gate or automatically injected context.

## Shared requirements

### Project truth and explicit context

Repository Markdown is the only editable source of project meaning. Project Config contains orchestration composition only; SQLite contains machine-local runtime facts, not a second project definition. Secrets, absolute machine paths, process state, histories and transient worktrees stay out of version-controlled authoring data. [ARCHITECTURE.md](../ARCHITECTURE.md) owns the active version matrix and source boundaries.

Selected Action instructions and Skills explicitly name the Overview, relevant stories, Event Storming model and accepted ADRs they need. The role reads those canonical sources; ambient or obsolete context and provider prompts must never replace project intent. Frozen Agent/Skill hashes establish the executable instruction closure without creating a platform-owned project-document closure. [ADR-041](adr/adr-041-instruction-directed-project-context-and-sortable-ordering.md), [ADR-042](adr/adr-042-action-specific-codex-agents.md) and [ADR-048](adr/adr-048-four-project-views.md) own the decisions.

Execution uses explicit supported model/reasoning choices and reports installation, authentication and capability failures before dispatch, without an automatic fallback. Each instruction/Skill is at most 128 KiB and the composed prompt at most 512 KiB; oversized content is rejected, never silently truncated. Exact prompt bytes, SHA-256 and source provenance are retained. They prove Ballet's composed input, not the provider's private or ambient context; raw provider reasoning is not a UI fact.

### Ordered execution and Validation

State `order` and Action `priority` are positive, unique integers. The runtime selects exactly the first pending Action in the first incomplete State in ascending order. A pending, running or blocked predecessor cannot be bypassed. Validation inspects first and returns only `done | delegate | blocked`; postwork returns only `done | retry | blocked`. `done` requires stable, independently inspectable evidence. Insufficient or contradictory evidence cannot produce `done`, and Work cannot choose routing or retry.

A delegated Work agent executes only Validation's bounded dynamic prompt in the managed worktree and returns `completed` or `needs_input` for postcheck. Work cannot approve itself, widen permissions or authorize external writes. Semantic retries allow exactly `1 + maxRetries` attempts (0→1, 2→3, 5→6); a retry passes the correction to the next Work attempt. Exhaustion commits the Action and exactly one Feedback entry as blocked in one transaction, including duplicate outcomes and restart. Provider failure never silently consumes semantic retry budget. Exact contracts: [state contract](arc42/STATE-CONTRACT.md), [runtime view](arc42/06-runtime-view.md), [ADR-034](adr/adr-034-validation-led-environment-state-action-orchestration.md).

### Human authority and isolation

Only an explicit human decision can approve a story, Critic proposal or Refinement proposal. Provider output and request payloads cannot name a trusted human actor. Critic and Refinement proposals are read-only and write zero project files. Internal Git work uses isolated managed worktrees, exact hashes, guarded paths and disabled hooks. Valid approved Refinement creates one local commit and one immutable continuation; stale content, changed base commit, forbidden paths or incomplete shared Skill impact create zero writes and zero continuations. The parent remains unchanged. External lifecycle and service writes require separate exact human authorization. See [security and trust boundaries](../ARCHITECTURE.md#security-and-trust-boundaries).

### Evidence, security and maintainability

Initiative completion requires passed priority-1 acceptance evidence. A document's existence alone covers zero acceptance criteria.

Every Action runs its named checks and reports their exact results. Checks must not be fabricated, disabled or skipped to claim completion. Existing artifacts alone prove no acceptance criterion. Continuous traceability connects requirements, measurable quality scenarios, decisions, components, runtime/deployment scenarios, executable checks and dated evidence; `validate:arc42` must report zero broken active chains before completion.

Core architecture preserves explicit domain boundaries, one owner per fact and maintainable dependencies, so local success does not introduce hidden coupling. Generic backend/frontend/shared code contains zero Ballet-specific workflow-ID branches. HTTP binds to loopback, validates strict requests and same-origin mutations; daemon requests require the checkout token, and token/config files use mode `0600`. Secrets and credentials never enter prompts, retained events or logs. Exact boundaries: [architecture](../ARCHITECTURE.md), [crosscutting concepts](arc42/08-crosscutting-concepts.md), [design](../DESIGN.md).

### Local lifecycle and distribution

Lifecycle commands manage the current checkout's server and daemon together. Distribution supports native macOS arm64/x64 bundles containing every required runtime component. Source installation builds and smoke-tests the current checkout; Homebrew and verified curl installation require a published release. Direct installation/update must verify SHA-256 and GitHub Artifact Attestation before atomic activation; Homebrew uses the formula-pinned SHA-256 and its own update lifecycle. Invalid architecture or failed verification activates zero packages. [ADR-009](adr/adr-009-varmennettu-macos-jakelu.md) retains the design and rationale; [deployment view](arc42/07-deployment-view.md) owns current placement and startup evidence.
