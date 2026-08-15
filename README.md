# Ballet

Ballet is a local command center for running Codex CLI and GitHub Copilot CLI agents in one Git checkout. Start it from the checkout root and Ballet hosts the UI, scheduler, SQLite state, execution queue, provider adapters, and Git worktrees in one local background process.

There is no account, pairing flow, remote daemon, device registry, or multi-project control plane. A second checkout gets its own isolated Ballet service.

## How it works

1. `ballet` verifies that the current directory is exactly a Git checkout root with a HEAD commit.
2. It creates checkout-local state under `.git/ballet`, chooses a free loopback port, and installs one uniquely named launchd job.
3. The local process probes Codex and Copilot, serves the UI on `127.0.0.1`, schedules Loops, and persists Run state in SQLite.
4. A Root Run resolves every reachable Loop, Step, Transition, ExecutionProfile, Project instruction, Project skill, the fixed System instruction, and the theme into one immutable snapshot before it queues work.
5. Agent and Scheduled Steps in that Root Run execute sequentially in the same worktree. Codex and Copilot each have a FIFO lane, so the two providers may run concurrently while one provider never runs two tasks at once.
6. Successful roots are committed and cleaned up. Failed, cancelled, or interrupted roots retain their worktree for inspection.

Queued work survives a Ballet restart. Work that was running when the process exited is marked failed as interrupted and is not silently rerun.

## Project and local state

Portable, version-controlled automation remains in the checkout:

- `.ballet/project.json` — strict project configuration v9, containing only `version`, an ID-sorted `executionProfiles` list, and `loops`; executable Steps own their task, composition references, transitions, schedule, and appearance;
- `.ballet/theme.json` — the single project-wide Loop visualization theme;
- `.ballet/instructions/**/*.md` — selectable Project primary instructions identified by frontmatter `id`;
- `.ballet/**/*.md` and `.ballet/**/*.mdx` — other project documents; and
- `.agents/skills/**/SKILL.md` — selectable Project skills identified by their relative directory path.

There is no top-level Agent execution entity in v9. `agent` remains a Step type, while `ExecutionProfile` is the only runtime authoring entity. Project instructions and skills are Step-selected resources; `.codex/agents` is not project configuration or a runtime source.

Machine-local state belongs to this clone's Git directory and never appears in Git status:

| Path | Contents |
| --- | --- |
| `.git/ballet/state.sqlite` | Runs, Steps, execution tasks and events, and schedule state |
| `.git/ballet/settings.json` | Provider command overrides and absolute read-only roots |
| `.git/ballet/service.json` | Stable checkout service identity and loopback port |
| `.git/ballet/instance-id` | Stable health-check identity for this clone |
| `.git/ballet/worktrees/` | Root-Run worktrees, including retained failures |
| `.git/ballet/logs/ballet.log` | Rotating local application log (20 MiB, five backups) |

The checkout-specific plist at `~/Library/LaunchAgents/ai.ballet.<checkout-hash>.plist` is the only Ballet-managed project state outside the Git directory. Provider credentials remain in the providers' own stores.

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
- Run opens the overview or a Loop target and shows durable Root Run, Loop Run, Work Loop Node Run, Node Run, State revision, and provider-task evidence. The v10 control-flow engine is intentionally fail-closed until its dedicated implementation phase.

Strict project configuration v10 stores `loops[].nodes` as composite Work Loop Nodes. Each composite owns one Work Node, one Validation Node, a local-attempt limit, and immutable authoring descriptions; mutable State belongs only to the Root Run. User-authored node Edges connect a Validation `OK` result to the next Work Loop Node or a Loop terminal target. Loop Edges describe normal `flow` routes or the source-Loop-specific `repair` allowlist. There are no authorable terminal nodes or `approved`/`rejected` transitions.

Provider-executed Work and Validation Nodes have a non-empty task, one `executionProfileId`, one `primaryInstructionId`, and set-semantic `skillIds`. Human Nodes have no execution composition, scheduled execution is available only to a Loop's starting Work Node, and Validation is never scheduled. ExecutionProfiles contain only ID, name, provider, model, reasoning effort, and network access. Provider commands and checkout-wide absolute `readOnlyRoots` are machine-local settings.

Every provider prompt is composed in a deterministic five-section order: fixed System instruction, one Project primary instruction, selected Project skills sorted by UTF-8 ID, Task Envelope V2, and the role-specific structured output schema. Work, Validation, and Orchestrator use separate strict schemas. Ballet records the exact UTF-8 prompt and SHA-256 alongside composition version 3, envelope version/hash, Node identity and role, profile snapshot, resource origin/ID/path/source hashes, and output-schema version 3/ID/hash. State is limited to 256 KiB, selected relevant history to 64 KiB, Task Envelope to 384 KiB, and the complete prompt to 512 KiB; semantic payloads are never silently truncated.

The fixed read-only `system:execution-contract-v3` establishes only instruction authority, tool and permission limits, secret-handling boundaries, role-specific structured outcomes, the prohibition on returning hidden chain-of-thought, and the requirement to report checks and artifact references where the schema requires them. Project workflow procedures belong in `.ballet/project.json`, `.ballet/instructions/**`, and `.agents/skills/**`, never in this System instruction or platform-specific workflow code.

## Local API

The process binds only to `127.0.0.1`. The UI uses these primary API groups:

| Purpose | Routes |
| --- | --- |
| Workspace snapshot | `GET /api/data` |
| Automation and theme | `PUT /api/automation`, `PUT /api/loop-theme` |
| Unified Runs | `POST/GET /api/runs`, `GET /api/runs/:rootRunId`, `POST /api/runs/:rootRunId/cancel` |
| Invalidations | `GET /api/stream` |
| Console | `GET /api/execution-tasks/:taskId/events`, `GET /api/execution-tasks/:taskId/console/stream` |
| Local Runtime | runtime status/refresh/settings routes used by the Runtime view |
| Health | `GET /api/health` |

The shared invalidation stream sends workspace/Run refresh signals only. A selected task's provider-neutral console events use its dedicated cursor-resumable SSE stream.

## Security and Git behavior

- The server accepts only loopback Host values and does not grant CORS access.
- Browser mutations require the Ballet origin; originless localhost requests are reserved for the local CLI lifecycle.
- Provider processes receive no Ballet service credentials and execute only in the managed root-Run worktree.
- Run preflight binds execution to the CLI version, model, reasoning setting, policy capabilities, HEAD commit, configuration hash, and immutable Root Run composition snapshot observed at start.
- Source code changes block a Run. Uncommitted `.ballet` files and `.agents/skills/**/SKILL.md` manifests are captured into the immutable Run snapshot instead.
- Network access defaults to off and must be enabled explicitly in the selected ExecutionProfile.
- A legacy `agentReadOnlyRoots` property in `.git/ballet/settings.json` blocks Run with an explicit remediation message. Ballet never silently drops or reinterprets those values; v9 local settings use only checkout-wide `readOnlyRoots`.
- A completed provider outcome is validated and persisted as `StepRun.status = completed` plus canonical `StepRun.result`; the Step Run is then read back, and only that persisted result may select the Approved or Rejected Transition. `needs_input`, technical `blocked`, `failed`, and `cancelled` states never select a Transition.
- Durable non-terminal console content is retained up to 1 MiB per task. Terminal protocol events remain available, and the UI exposes truncation state.

Ballet does not merge or push Run results automatically.

## Upgrade from Runtime & Daemon v1

Before installing this architecture, stop the old global jobs if they exist:

```bash
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/ai.ballet.server.plist 2>/dev/null || true
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/ai.ballet.daemon.plist 2>/dev/null || true
```

The old `~/.ballet/control-plane.sqlite`, pairing state, attachments, history, and daemon configuration are intentionally not migrated or deleted. Each checkout starts a clean local schema under `.git/ballet`.

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

The native release smoke test additionally loads packaged `better-sqlite3`, starts the packaged server against a committed strict-v9 fixture checkout, verifies the fixture ExecutionProfile, Loop composition, Project instruction, and v3 theme through `GET /api/data`, checks `.git/ballet/state.sqlite`, confirms Git remains clean, and exercises graceful shutdown.
