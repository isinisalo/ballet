# Ballet

Ballet is a local command center for running Codex CLI and GitHub Copilot CLI agents in one Git checkout. Start it from the checkout root and Ballet hosts the UI, scheduler, SQLite state, execution queue, provider adapters, and Git worktrees in one local background process.

There is no account, pairing flow, remote daemon, device registry, or multi-project control plane. A second checkout gets its own isolated Ballet service.

## How it works

1. `ballet` verifies that the current directory is exactly a Git checkout root with a HEAD commit.
2. It creates checkout-local state under `.git/ballet`, chooses a free loopback port, and installs one uniquely named launchd job.
3. The local process probes Codex and Copilot, serves the UI on `127.0.0.1`, schedules Loops, and persists Run state in SQLite.
4. A Graph Root Run resolves the Graph, its start Loop, every reachable Loop, named transition, repair route, Workflow Node/Edge, ExecutionProfile and prompt resource into one immutable snapshot. A Loop Root Run snapshots only its isolated Loop and reachable repairs.
5. Terminal Validation selects an allowed `decision`/`outcome` pair. The RunBook engine resolves the exact target from the snapshot; only a separate repair request invokes the optional agent repair-router and durable call/return path.
6. Before work continues, the tracker outbox reconciles one orchestration epic for the Root Run and one child chore per Loop invocation. Job, Validation, and repair-router Node Runs then execute sequentially in the same worktree.
7. Successful roots are committed and cleaned up. Failed, cancelled, or interrupted roots retain their worktree for inspection.

Queued work survives a Ballet restart. Work that was running when the process exited is marked failed as interrupted and is not silently rerun.

## Project and local state

Portable, version-controlled automation remains in the checkout:

- `.ballet/project.json` — strict project configuration v13 with `executionProfiles`, the pinned `issueTracker`, a `mode: runbook` Orchestrator, Graph `startLoopId`, named `transitions`, separate `repairEdges`, and 1–40 project-local Loops;
- `.ballet/releases/STORY-RELEASE-MAP.md` — the ordered docs-as-code release/story map; implementation tasks are not duplicated here;
- `.tickets/orchestration` and `.tickets/work` — worktree-local `tk` stores for Run tracking and implementation work;
- `.ballet/theme.json` — the strict-v4 single project-wide Loop visualization theme;
- `.ballet/instructions/**/*.md` — selectable Project primary instructions identified by frontmatter `id`;
- `.ballet/loop-library/**/*.ballet-loop.json` — version-controlled one-Loop authoring packages listed by the local Loop Library;
- `.ballet/loop-modules/installed.json` — installed-module provenance and resource ownership metadata, never a runtime definition;
- `.ballet/**/*.md` and `.ballet/**/*.mdx` — other project documents; and
- `.agents/skills/**/SKILL.md` — selectable Project skills identified by their relative directory path.

There is no top-level Agent execution entity. `agent` is a Job or Validation Node type, while `ExecutionProfile` is the only runtime authoring entity. Project instructions and skills are Node-selected resources; `.codex/agents` is not project configuration or a runtime source.

`LoopModulePackageV3` is a portable authoring artifact, not a project-config field or runtime entity. `Add Loop` can inspect and materialize one package into a strict-v13 Loop plus namespaced project instructions and skills. Profile slots map to existing ExecutionProfiles during install. `recommendedTransitions` and `recommendedRepairs` are advisory only; the package never names or silently installs an authoritative peer target. The DEPLOY package declares `externalWrites: "requires-human-authorization"`.

Machine-local state belongs to this clone's Git directory and never appears in Git status:

| Path | Contents |
| --- | --- |
| `.git/ballet/state.sqlite` | LocalDatabase schema v9: Root/Loop/Job/Node Runs, Graph orchestration state, State revisions, repair continuations, tracker outbox/links, execution tasks/events, and schedule state |
| `.git/ballet/settings.json` | Provider and optional `tk` command overrides plus absolute read-only roots |
| `.git/ballet/service.json` | Stable checkout service identity and loopback port |
| `.git/ballet/instance-id` | Stable health-check identity for this clone |
| `.git/ballet/worktrees/` | Root-Run worktrees, including retained failures |
| `.git/ballet/logs/ballet.log` | Rotating local application log (20 MiB, five backups) |

The checkout-specific plist at `~/Library/LaunchAgents/ai.ballet.<checkout-hash>.plist` is the only Ballet-managed project state outside the Git directory. Provider credentials remain in the providers' own stores.

## Architecture and continuous development

Humans and agents start from [`ARCHITECTURE.md`](ARCHITECTURE.md). It links the canonical twelve-section arc42 Template under `.ballet/arc42/`, persistent project status and handoff, traceability, method health, the shared State contract, accepted Goals/ADRs and `DESIGN.md`.

The repository's default development Method is a five-Loop project-local RunBook:

```text
DESIGN → PLAN → BUILD → DEPLOY → VERIFY → DONE
           ↑       │                 │
           └───────┴── more work ───┘
```

DESIGN runs twelve ordered Job/Validation pairs, one for each canonical arc42 section. PLAN selects the first eligible release from the Story/Release Map and materializes its epic, issues, acceptance references and dependencies in the work store. Each BUILD invocation handles one ready issue. DEPLOY pauses for exact human authorization before an external write, and VERIFY compares the deployed release with all twelve design sections, release acceptance and ticket evidence. Named failure outcomes route back to DESIGN, PLAN, BUILD or DEPLOY exactly as configured; VERIFY either selects more work or the explicit `DONE` transition.

Ordinary RunBook routing never asks a model to select the target. A custom graph may additionally configure Repair Edges and an agent repair-router; those routes retain the durable Validation → repair Loop → same Validation LIFO return semantics. Ambiguous repair stays in `needs_input`.

To start a new initiative:

1. Copy `.ballet/arc42/initiatives/TEMPLATE/` to `.ballet/arc42/initiatives/<initiative-id>/`.
2. Give BRIEF, PLAN, EVIDENCE and REVIEW unique stable frontmatter IDs and start their status as `draft`.
3. Add or refine the planned release in the Story/Release Map and start the Graph target; DESIGN begins from section 01. An isolated DESIGN Loop Run is available for bounded authoring without Graph continuation.
4. Stop for human input when intent, a top-quality priority/measure or another required decision is missing.

Markdown contains long-lived project truth: accepted intent and decisions, twelve architecture views, the release map, initiative reviews and evidence references. `GraphEngineeringStateV1` contains only the selected release/map reference, active work issue and remaining count, target environment, deployment authorization/evidence references and verification result. `GraphOrchestrationStateV1` separately owns current Graph/Loop and transition/tracking references. Neither State copies documents, ticket bodies, logs or source diffs.

Validate the complete project-local contract with:

```bash
npm run validate:arc42
```

Human approval is required for new or changed WHAT/WHY, top-quality priority/acceptance measures, significant ADR acceptance, implementation acceptance before release, release/deploy/rollback or another external write, and changes to Loop topology, permissions, network access or automation instruction/skill behavior. Mechanical non-semantic link/index/format/lint fixes do not need a dedicated gate.

Ballet does not merge or push Run results automatically, and the arc42 Method does not grant release, deploy or rollback permission.

## Install on macOS

Ballet supports macOS `arm64` and `x64`. Install and authenticate at least one provider CLI first. Every Run also requires the tested [`tk` revision `d778bb5`](https://github.com/h2oai/tk/tree/d778bb520ee526c314c26f2bb876447e0a19caa5):

```bash
go install github.com/lo5/tk@d778bb520ee526c314c26f2bb876447e0a19caa5
```

Keep the resulting `tk` executable on `PATH`, or configure its absolute path with `--tk-command`. Run preflight probes the required commands and validates strict JSONL, Markdown, parent, dependency, cycle and external-reference behavior in a temporary store. A missing or incompatible executable blocks the Run without mutating project tickets.

### Install the current checkout

Use this path while developing an unreleased checkout. It builds the production bundle, runs the packaged release smoke test, and atomically installs `ballet` under `${BALLET_INSTALL_PREFIX:-$HOME/.local}/bin`.

```bash
npm install
npm run release:install
export PATH="$HOME/.local/bin:$PATH"
ballet version
```

During repository development, run the following from the checkout root to build and smoke-test the current source, atomically install it, restart this checkout's Ballet service from the new bundle, and print its health status:

```bash
make
```

`make latest` is the equivalent explicit target. Override the local installation prefix with `BALLET_INSTALL_PREFIX=/path make` when needed. The restart is graceful but interrupts queued or running work according to the normal `ballet restart` lifecycle contract.

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
  --copilot-command /absolute/path/to/copilot \
  --tk-command /absolute/path/to/tk
```

Use `--no-open` when the browser should not open automatically. Ballet still starts when neither CLI is ready; the Runtime view and Run preflight show provider-specific installation or authentication repair instructions.

## CLI reference

```text
ballet [--codex-command <path>] [--copilot-command <path>] [--tk-command <path>] [--no-open]
ballet stop
ballet restart
ballet status
ballet logs [--lines N] [--follow]
ballet update
ballet tracker query
ballet tracker ready [--release <epic-id>]
ballet tracker claim --release <epic-id>
ballet tracker upsert --external-ref <ref> --title <title> --type <type> [options]
ballet tracker start|note|close|reopen ...
ballet version
```

Every lifecycle command except `version` and `help` acts only on the checkout whose root is the current directory. `stop` asks that process to cancel queued/running work and drain finalization for up to 90 seconds before unloading its launchd job. `update` verifies and activates the new release, then restarts only the current checkout service.

Different clones may run at the same time. Each has a path-derived service label, stable instance ID, independent state database, and its own automatically selected loopback port.

## Configure and Run

The upper-left Ballet dropdown switches the application between **Configure** and **Run**.

- Configure edits repository-backed project documents, Project instructions, Project skills, ExecutionProfiles, the single Loop theme, Graph name/start, named transitions, separate Repair Edges, Workflow Job/Validation Nodes, Pass/Fail Edges, and start-Job schedules.
- Run offers one Graph target and each Loop as an isolated target. Graph Runs follow named transitions; explicit Loop and scheduled Job runs end after the selected Loop. Repairs use only snapshotted Repair Edges and return to the requesting Validation through a persisted LIFO continuation.

Strict project configuration v13 stores one `ProjectWorkflow` per Loop. Every JobNode owns exactly one ValidationNode, and every ValidationNode owns exactly one PassEdge and one FailEdge. A PassEdge targets the next JobNode or fixed Workflow `PASS`; a FailEdge targets fixed Workflow `FAIL`. Every Job and Loop is reachable from its configured start, and a Graph has at least one reachable `DONE` path. Each `(source, decision, outcome)` transition key is unique. Ordinary transitions and capability-based Repair Edges are separate collections.

A Loop has a required functional description and a State definition consisting of a description and JSON initial value. A manual or scheduled Root Run creates State revision 0 from the root Loop's initial value. A completed Job outcome may atomically commit a JSON Patch before its paired Validation; Validation `PASS` may do the same before its PassEdge is followed. Validation `FAIL` cannot patch State. Every accepted patch creates exactly one append-only revision with a hash, source Node Run and bounded patch evidence. An invalid or oversized patch rolls back the outcome transaction, and the UI never reconstructs State from event text.

Job completion always moves to the paired ValidationNode. A Validation `FAIL` returns to the paired Job while its `maxRetries` budget remains. At terminal Workflow PASS/FAIL in a Graph Run, Validation selects one allowed named outcome; runtime resolves the exact immutable transition and stops before transition 257. A terminal FAIL may instead create a target-free Repair Request, but cannot provide both a transition and repair request. The optional repair-router can select only a source-specific snapshotted Repair Edge. After repair Workflow PASS, runtime calls the original Validation again without rerunning its Job or resetting its retry count. Technical `blocked` or `failed` states terminate without following a RunBook transition.

Provider-executed Job and Validation Nodes have a non-empty task, one `executionProfileId`, one `primaryInstructionId`, and set-semantic `skillIds`. Human Nodes have no execution composition, scheduled execution is available only to a Loop's starting JobNode, and Validation is never scheduled. ExecutionProfiles contain only ID, name, provider, model, reasoning effort, and network access. Provider commands, `tkCommand`, and checkout-wide absolute `readOnlyRoots` are machine-local settings.

Every provider prompt is composed in a deterministic five-section order: fixed System instruction, one Project primary instruction, selected Project skills sorted by UTF-8 ID, Task Envelope V6, and the role-specific structured output schema V6. A terminal Validation envelope contains the exact allowed RunBook transitions, and its output schema constrains outcomes per decision. Ballet records execution spec V8, composition V7, envelope/hash, Node identity, profile/resource provenance, and the exact output-schema hash. State is limited to 256 KiB, selected relevant history to 64 KiB, Task Envelope to 384 KiB, and the complete prompt to 512 KiB.

The fixed read-only `system:execution-contract-v4` establishes only instruction authority, tool and permission limits, secret-handling boundaries, role-specific structured outcomes, the prohibition on returning hidden chain-of-thought, and the requirement to report checks and artifact references where the schema requires them. Project workflow procedures belong in `.ballet/project.json`, `.ballet/instructions/**`, and `.agents/skills/**`, never in this System instruction or platform-specific workflow code.

Run is a mission control built from immutable snapshot and canonical SQLite evidence. **Mission** focuses the current objective and active route, **All Loops** exposes the complete snapshotted Loop topology, and the **live inspector** shows the active Loop and Workflow Node, Job/Validation/Orchestrator role, ExecutionProfile, Job attempt, State revision, repair call, LIFO return and finalization. It does not invent completion percentages, ETA/elapsed telemetry or state derived from provider prose. Human Job and Human Validation use separate labeled forms; an Orchestrator that needs input accepts only a resume response. Configure edits repository-backed definitions, while Run remains a read-only canonical projection.

## Local API

The process binds only to `127.0.0.1`. The UI uses these primary API groups:

| Purpose | Routes |
| --- | --- |
| Workspace snapshot | `GET /api/data` |
| Automation and theme | `PUT /api/automation`, `PUT /api/loop-theme` |
| Loop modules | `GET /api/loop-modules/library`, inspection, install-plan/commit, export, status and provenance-aware remove routes under `/api/loop-modules` |
| Unified Runs | `POST/GET /api/runs`, `GET /api/runs/:rootRunId`, `GET /api/runs/:rootRunId/state`, `POST /api/runs/:rootRunId/cancel` |
| Human/resume response | `POST /api/runs/:rootRunId/nodes/:nodeRunId/respond` |
| Invalidations | `GET /api/stream` |
| Console | `GET /api/execution-tasks/:taskId/events`, `GET /api/execution-tasks/:taskId/console/stream` |
| Local Runtime | runtime status/refresh/settings routes used by the Runtime view |
| Health | `GET /api/health` |

The shared invalidation stream sends workspace/Run refresh signals only. A `runs-changed` event identifies the Root Run and its canonical State revision and status; it never carries provider text or a route decision. A selected task's provider-neutral console events use its dedicated cursor-resumable SSE stream.

Human Job and Validation responses use the same strict role-specific outcomes as provider execution. A paused Job, Validation, or Orchestrator Node resumes without a caller-selected return target:

```json
{"kind":"job","outcome":{"role":"job","state":"completed","summary":"Done.","artifacts":{},"checks":[]}}
```

```json
{"kind":"validation","outcome":{"role":"validation","state":"completed","decision":"FAIL","summary":"Correction required.","evidence":{},"checks":[],"feedback":"Fix the check.","expectedCorrection":"The check passes.","escalation":{"reason":"The acceptance check failed.","evidenceRefs":[],"requestedCapability":"project:implementation.corrected"}}}
```

```json
{"kind":"resume","response":"Use the project-local evidence."}
```

`GET /api/runs/:rootRunId/state` returns the current revision, current State and hash, plus bounded revision metadata and patch evidence. It does not accept mutations; State changes only through an atomically committed Node outcome.

## Security and Git behavior

- Imported Loop packages are untrusted prompt-bearing JSON. Inspection is strict and size-bounded; install exposes source, SHA-256, profile/network compatibility and exact project files, performs no remote fetch or script hook, and writes `.ballet/project.json` last.
- The server accepts only loopback Host values and does not grant CORS access.
- Browser mutations require the Ballet origin; originless localhost requests are reserved for the local CLI lifecycle.
- Provider processes receive no Ballet service credentials and execute only in the managed root-Run worktree.
- Run preflight binds execution to the CLI version, model, reasoning setting, policy capabilities, HEAD commit, configuration hash, and immutable Root Run composition snapshot observed at start.
- Source code changes block a Run. Uncommitted `.ballet` files and `.agents/skills/**/SKILL.md` manifests are captured into the immutable Run snapshot instead.
- Network access defaults to off and must be enabled explicitly in the selected ExecutionProfile.
- A legacy `agentReadOnlyRoots` property in `.git/ballet/settings.json` blocks Run with an explicit remediation message. Ballet never silently drops or reinterprets those values; the current local settings contract uses only checkout-wide `readOnlyRoots`.
- A provider outcome is validated against the immutable Node role and allowed terminal transition enum before control flow. Ordinary Graph routing uses exact snapshot data, not a provider-selected target. Repair routing uses only a snapshotted allowlist, while the persisted continuation—not model output—determines the return Validation Node.
- `tk` commands run as argv arrays without a shell, only against configured stores inside the worktree, with timeout and output limits. Stable external references prevent duplicate Root Run, Loop invocation and release tickets across retries or restart.
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

The native release smoke test additionally loads packaged `better-sqlite3`, starts the packaged server against a committed strict-v13 fixture checkout, verifies its V3 Loop Module, ExecutionProfile, Workflow pair, named Graph transition, separate repair policy and strict-v4 theme through `GET /api/data`, checks schema-v9 SQLite tables, confirms Git remains clean, and exercises graceful shutdown. The hermetic tracker suites do not replace a real pinned-`tk` smoke; when `tk` is unavailable, that omission is reported explicitly.
