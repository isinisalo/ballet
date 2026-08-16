# Ballet

Ballet is a local command center for running Codex CLI and GitHub Copilot CLI agents in one Git checkout. Start it from the checkout root and Ballet hosts the UI, scheduler, SQLite state, execution queue, provider adapters, and Git worktrees in one local background process.

There is no account, pairing flow, remote daemon, device registry, or multi-project control plane. A second checkout gets its own isolated Ballet service.

## How it works

1. `ballet` verifies that the current directory is exactly a Git checkout root with a HEAD commit.
2. It creates checkout-local state under `.git/ballet`, chooses a free loopback port, and installs one uniquely named launchd job.
3. The local process probes Codex and Copilot, serves the UI on `127.0.0.1`, schedules Loops, and persists Run state in SQLite.
4. A Root Run resolves every reachable Loop, Work Loop Node, Node Edge, allowed Loop Edge, ExecutionProfile, Project instruction, Project skill, the fixed System instruction, and the theme into one immutable snapshot before it queues work.
5. Work, Validation, and Orchestrator Node Runs in that Root Run execute sequentially in the same worktree. Codex and Copilot each have a FIFO lane, so the two providers may run concurrently while one provider never runs two tasks at once.
6. Successful roots are committed and cleaned up. Failed, cancelled, or interrupted roots retain their worktree for inspection.

Queued work survives a Ballet restart. Work that was running when the process exited is marked failed as interrupted and is not silently rerun.

## Project and local state

Portable, version-controlled automation remains in the checkout:

- `.ballet/project.json` — strict project configuration v10, containing only `version`, `executionProfiles`, `orchestrator`, `loops`, and `loopEdges`; composite Work Loop Nodes own their Work and Validation definitions, while mutable State remains runtime-only;
- `.ballet/theme.json` — the strict-v4 single project-wide Loop visualization theme;
- `.ballet/instructions/**/*.md` — selectable Project primary instructions identified by frontmatter `id`;
- `.ballet/**/*.md` and `.ballet/**/*.mdx` — other project documents; and
- `.agents/skills/**/SKILL.md` — selectable Project skills identified by their relative directory path.

There is no top-level Agent execution entity in v10. `agent` is a Work or Validation Node type, while `ExecutionProfile` is the only runtime authoring entity. Project instructions and skills are Node-selected resources; `.codex/agents` is not project configuration or a runtime source.

Machine-local state belongs to this clone's Git directory and never appears in Git status:

| Path | Contents |
| --- | --- |
| `.git/ballet/state.sqlite` | LocalDatabase schema v6: Root/Loop/Work Loop Node/Node Runs, State revisions, repair continuations, execution tasks/events, and schedule state |
| `.git/ballet/settings.json` | Provider command overrides and absolute read-only roots |
| `.git/ballet/service.json` | Stable checkout service identity and loopback port |
| `.git/ballet/instance-id` | Stable health-check identity for this clone |
| `.git/ballet/worktrees/` | Root-Run worktrees, including retained failures |
| `.git/ballet/logs/ballet.log` | Rotating local application log (20 MiB, five backups) |

The checkout-specific plist at `~/Library/LaunchAgents/ai.ballet.<checkout-hash>.plist` is the only Ballet-managed project state outside the Git directory. Provider credentials remain in the providers' own stores.

## Architecture and continuous development

Humans and agents start from [`ARCHITECTURE.md`](ARCHITECTURE.md). It links the canonical twelve-section arc42 Template under `.ballet/arc42/`, persistent project status and handoff, traceability, method health, the shared State contract, accepted Goals/ADRs and `DESIGN.md`.

The repository's default development Method is implemented as project-local Ballet Loops:

```text
arc42-clarify-requirements
  → arc42-design-structures
  → arc42-design-concepts
  → arc42-communicate-document
  → arc42-accompany-implementation
  → arc42-analyze-evaluate
  → completed
```

This is a default path, not a waterfall. Validation describes a missing capability or outcome, the Orchestrator selects only a source-Loop-allowlisted repair target, and runtime returns to the requesting Validation Node through its persisted continuation. An ambiguous target yields `needs_input`; the first candidate is never a fallback. `arc42-continuous-learning` is a separate scheduled support Loop, and `release-validation` is an unchained support Loop.

To start a new initiative:

1. Copy `.ballet/arc42/initiatives/TEMPLATE/` to `.ballet/arc42/initiatives/<initiative-id>/`.
2. Give BRIEF, PLAN, EVIDENCE and REVIEW unique stable frontmatter IDs and start their status as `draft`.
3. Run `arc42-clarify-requirements` with the initiative ID and human-owned WHAT/WHY, priority and acceptance intent.
4. Stop for human input when intent, a top-quality priority/measure or another required decision is missing.

Markdown contains long-lived project truth: accepted intent and decisions, architecture views, initiative plans/reviews and evidence references. Root Run State and the Runtime UI contain execution truth: the current bounded initiative/architecture/delivery/release/evaluation/handoff references, revision history, attempts, Repair Requests, routes and outcomes. State never copies full documents, logs or source diffs.

Validate the complete project-local contract with:

```bash
npm run validate:arc42
```

Human approval is required for new or changed WHAT/WHY, top-quality priority/acceptance measures, significant ADR acceptance, implementation acceptance before release, release/deploy/rollback or another external write, and changes to Loop topology, permissions, network access or automation instruction/skill behavior. Mechanical non-semantic link/index/format/lint fixes do not need a dedicated gate.

The learning start Node runs weekly on Monday at 09:00 in `Europe/Helsinki`. Change `loops[arc42-continuous-learning].nodes[learning-authoritative-research].work.schedule` and its `startsOn` value in `.ballet/project.json` only as a reviewed automation-behavior change, then run `npm run validate:arc42`, tests, lint and build. Network stays enabled only for that research Work Node and explicitly authorized release evidence Nodes.

Ballet does not merge or push Run results automatically, and the arc42 Method does not grant release, deploy or rollback permission.

## Install on macOS

Ballet supports macOS `arm64` and `x64`. Install and authenticate at least one provider CLI first.

### Install the current checkout

Use this path while developing an unreleased checkout. It builds the production bundle, runs the packaged release smoke test, and atomically installs `ballet` under `${BALLET_INSTALL_PREFIX:-$HOME/.local}/bin`.

```bash
npm install
npm run release:install
export PATH="$HOME/.local/bin:$PATH"
ballet version
```

To run directly from source without installing the CLI, use `npm run dev` and open `http://127.0.0.1:5173`.

The Homebrew and verified curl methods below require a published GitHub release. If the repository has no release yet, use the current-checkout installation above.

### Homebrew

```bash
brew install isinisalo/tap/ballet
```

### Verified curl installer

The direct installer requires `curl`, `tar`, `shasum`, and GitHub CLI (`gh`). It verifies both SHA-256 and the GitHub Artifact Attestation before activating a release.

```bash
curl --proto '=https' --tlsv1.2 -fsSL \
  https://raw.githubusercontent.com/isinisalo/ballet/main/scripts/install.sh | sh
```

Direct installs keep immutable release bundles under `<prefix>/libexec/ballet/versions/` and atomically retarget `<prefix>/bin/ballet` only after validation.

## Start Ballet

Run Ballet from the exact root of any local Git checkout with at least one commit. A GitHub remote is not required.

```bash
cd YOUR-CHECKOUT
ballet
```

If a provider executable is outside the launchd `PATH`, save its command for this checkout:

```bash
ballet \
  --codex-command /absolute/path/to/codex \
  --copilot-command /absolute/path/to/copilot
```

Use `--no-open` when the browser should not open automatically. Ballet still starts when neither CLI is ready; the Runtime view and Run preflight show provider-specific installation or authentication repair instructions.

## CLI reference

```text
ballet [--codex-command <path>] [--copilot-command <path>] [--no-open]
ballet stop
ballet restart
ballet status
ballet logs [--lines N] [--follow]
ballet update
ballet version
```

Every lifecycle command except `version` and `help` acts only on the checkout whose root is the current directory. `stop` asks that process to cancel queued/running work and drain finalization for up to 90 seconds before unloading its launchd job. `update` verifies and activates the new release, then restarts only the current checkout service.

Different clones may run at the same time. Each has a path-derived service label, stable instance ID, independent state database, and its own automatically selected loopback port.

## Configure and Run

The upper-left Ballet dropdown switches the application between **Configure** and **Run**.

- Configure edits repository-backed project documents, Project instructions, Project skills, ExecutionProfiles, the single project Loop theme, Work Loops, Edges, Loop Edges, and Work Node schedules.
- Run opens the overview or a Loop target and shows durable Root Run, Loop Run, Work Loop Node Run, Node Run, State revision, and provider-task evidence. External repairs are routed only through snapshotted repair Loop Edges and return to the requesting Validation Node through a persisted LIFO continuation.

Strict project configuration v10 stores `loops[].nodes` as composite Work Loop Nodes. Each composite owns one Work Node, one Validation Node, a local-attempt limit, and immutable authoring descriptions; mutable State belongs only to the Root Run. User-authored node Edges connect a Validation `OK` result to the next Work Loop Node or a Loop terminal target. Loop Edges describe normal `flow` routes or the source-Loop-specific `repair` allowlist. There are no authorable terminal nodes or `approved`/`rejected` transitions.

A Loop has a required functional description and a State definition consisting of a description and JSON initial value. A manual or scheduled Root Run creates State revision 0 from the root Loop's initial value. A completed Work outcome may atomically commit a JSON Patch before Validation; Validation `OK` may do the same before its configured Node Edge is followed. Every accepted patch creates exactly one append-only revision with a hash, source Node Run and bounded patch evidence. An invalid or oversized patch rolls back the outcome transaction, and the UI never reconstructs State from event text.

Validation `FAIL/LOCAL_RETRY` returns to the Work phase of the same composite Work Loop Node and increments its local attempt within `maxLocalAttempts`. Validation `FAIL/ORCHESTRATOR_REPAIR` persists a Repair Request and continuation, then invokes the Loop Orchestrator. The Orchestrator can select only a target described in the immutable snapshot and allowlisted by a source-specific repair Loop Edge. The target repair Loop shares the Root Run's canonical State. On successful completion, runtime pops the persisted continuation and calls the original Validation phase again; model output cannot choose the return target. Nested repair uses the same engine and returns in LIFO order under explicit depth, attempt and transition limits.

Provider-executed Work and Validation Nodes have a non-empty task, one `executionProfileId`, one `primaryInstructionId`, and set-semantic `skillIds`. Human Nodes have no execution composition, scheduled execution is available only to a Loop's starting Work Node, and Validation is never scheduled. ExecutionProfiles contain only ID, name, provider, model, reasoning effort, and network access. Provider commands and checkout-wide absolute `readOnlyRoots` are machine-local settings.

Every provider prompt is composed in a deterministic five-section order: fixed System instruction, one Project primary instruction, selected Project skills sorted by UTF-8 ID, Task Envelope V3, and the role-specific structured output schema. Work, Validation, and Orchestrator use separate strict schemas. Ballet records the exact UTF-8 prompt and SHA-256 alongside composition version 4, envelope version/hash, Node identity and role, profile snapshot, resource origin/ID/path/source hashes, and output-schema version 3/ID/hash. State is limited to 256 KiB, selected relevant history to 64 KiB, Task Envelope to 384 KiB, and the complete prompt to 512 KiB; semantic payloads are never silently truncated.

The fixed read-only `system:execution-contract-v3` establishes only instruction authority, tool and permission limits, secret-handling boundaries, role-specific structured outcomes, the prohibition on returning hidden chain-of-thought, and the requirement to report checks and artifact references where the schema requires them. Project workflow procedures belong in `.ballet/project.json`, `.ballet/instructions/**`, and `.agents/skills/**`, never in this System instruction or platform-specific workflow code.

Run shows the immutable All Loops graph, active Loop and composite Work Loop Node, active Work/Validation/Orchestrator role, local attempt, repair depth, pending Repair Request, routed target, return destination, canonical State revision history, finalization and each provider task's cursor-resumable console. Human Work and Human Validation use separate labeled forms; an Orchestrator that needs input accepts only a resume response. Configure edits repository-backed definitions, while Run is a read-only projection of snapshot and SQLite evidence.

## Local API

The process binds only to `127.0.0.1`. The UI uses these primary API groups:

| Purpose | Routes |
| --- | --- |
| Workspace snapshot | `GET /api/data` |
| Automation and theme | `PUT /api/automation`, `PUT /api/loop-theme` |
| Unified Runs | `POST/GET /api/runs`, `GET /api/runs/:rootRunId`, `GET /api/runs/:rootRunId/state`, `POST /api/runs/:rootRunId/cancel` |
| Human/resume response | `POST /api/runs/:rootRunId/nodes/:nodeRunId/respond` |
| Invalidations | `GET /api/stream` |
| Console | `GET /api/execution-tasks/:taskId/events`, `GET /api/execution-tasks/:taskId/console/stream` |
| Local Runtime | runtime status/refresh/settings routes used by the Runtime view |
| Health | `GET /api/health` |

The shared invalidation stream sends workspace/Run refresh signals only. A `runs-changed` event identifies the Root Run and its canonical State revision and status; it never carries provider text or a route decision. A selected task's provider-neutral console events use its dedicated cursor-resumable SSE stream.

Human Work and Validation responses use the same strict role-specific outcomes as provider execution. A paused Work, Validation, or Orchestrator Node resumes without a caller-selected return target:

```json
{"kind":"work","outcome":{"role":"work","state":"completed","summary":"Done.","artifacts":{},"checks":[]}}
```

```json
{"kind":"validation","outcome":{"role":"validation","state":"completed","decision":"FAIL","summary":"Retry required.","evidence":{},"checks":[],"repair":{"mode":"LOCAL_RETRY","feedback":"Fix the check.","expectedCorrection":"The check passes."}}}
```

```json
{"kind":"resume","response":"Use the project-local evidence."}
```

`GET /api/runs/:rootRunId/state` returns the current revision, current State and hash, plus bounded revision metadata and patch evidence. It does not accept mutations; State changes only through an atomically committed Node outcome.

## Security and Git behavior

- The server accepts only loopback Host values and does not grant CORS access.
- Browser mutations require the Ballet origin; originless localhost requests are reserved for the local CLI lifecycle.
- Provider processes receive no Ballet service credentials and execute only in the managed root-Run worktree.
- Run preflight binds execution to the CLI version, model, reasoning setting, policy capabilities, HEAD commit, configuration hash, and immutable Root Run composition snapshot observed at start.
- Source code changes block a Run. Uncommitted `.ballet` files and `.agents/skills/**/SKILL.md` manifests are captured into the immutable Run snapshot instead.
- Network access defaults to off and must be enabled explicitly in the selected ExecutionProfile.
- A legacy `agentReadOnlyRoots` property in `.git/ballet/settings.json` blocks Run with an explicit remediation message. Ballet never silently drops or reinterprets those values; the current local settings contract uses only checkout-wide `readOnlyRoots`.
- A provider outcome is validated against the immutable Node role and persisted canonically before the engine reads it back for control flow. Work completion advances only to Validation; Validation `OK` follows its Node Edge, `FAIL/LOCAL_RETRY` returns to Work within the configured limit, and `FAIL/ORCHESTRATOR_REPAIR` creates a durable request. Orchestrator routes only to a snapshotted repair allowlist target, while the persisted continuation—not model output—determines the return Validation Node.
- Durable non-terminal console content is retained up to 1 MiB per task. Terminal protocol events remain available, and the UI exposes truncation state.
- Cancellation terminalizes the active Root/Loop/composite/Node records and every open repair frame without reverting a committed State revision. On restart, queued work and pending repair continuations remain durable; an execution that was running is marked interrupted according to policy, and recovery resumes only from the last fully committed revision.

Ballet does not merge or push Run results automatically.

## Upgrade from Runtime & Daemon v1

Before installing this architecture, stop the old global jobs if they exist:

```bash
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/ai.ballet.server.plist 2>/dev/null || true
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/ai.ballet.daemon.plist 2>/dev/null || true
```

The old `~/.ballet/control-plane.sqlite`, pairing state, attachments, history, and daemon configuration are intentionally not migrated or deleted. Each checkout starts a clean local schema under `.git/ballet`.

Local runtime schema cutovers also fail closed: Ballet leaves an incompatible `.git/ballet/state.sqlite` unchanged and reports both the found and expected schema versions before launchd startup. After `ballet stop`, archive `state.sqlite` and any `state.sqlite-wal`/`state.sqlite-shm` companions together if the pre-release Run history is no longer active; the next `ballet` start creates the current clean schema. There is no automatic runtime migration or deletion.

## Local development

```bash
npm install
npm run dev
```

Development serves Vite on `http://127.0.0.1:5173` and the local API on its configured loopback port. Use `npm run ballet -- --help` to run the TypeScript CLI.

Build and run the production bundle:

```bash
npm run build
npm run preview
```

## Verify

Provider adapter tests are fixture-backed and do not invoke installed CLIs.

```bash
npm run test
npm run lint
npm run build
npx @google/design.md lint DESIGN.md
git diff --check
```

The native release smoke test additionally loads packaged `better-sqlite3`, starts the packaged server against a committed strict-v10 fixture checkout, verifies the fixture ExecutionProfile, Work Loop composition, Project instruction, Orchestrator, and strict-v4 theme through `GET /api/data`, checks `.git/ballet/state.sqlite`, confirms Git remains clean, and exercises graceful shutdown.
