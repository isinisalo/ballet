# Ballet

Ballet is a local command center for running Codex CLI and GitHub Copilot CLI agents in one Git checkout. Start it from the checkout root and Ballet hosts the UI, scheduler, SQLite state, execution queue, provider adapters, and Git worktrees in one local background process.

There is no account, pairing flow, remote daemon, device registry, or multi-project control plane. A second checkout gets its own isolated Ballet service.

## How it works

1. `ballet` verifies that the current directory is exactly a Git checkout root with a HEAD commit.
2. It creates checkout-local state under `.git/ballet`, chooses a free loopback port, and installs one uniquely named launchd job.
3. The local process probes Codex and Copilot, serves the UI on `127.0.0.1`, schedules Loops, and persists Run state in SQLite.
4. A Run snapshots `.ballet`, `.codex/agents`, and `.agents/skills` into one root-Run worktree under `.git/ballet/worktrees`.
5. Agent Steps in that root Run execute sequentially in the same worktree. Codex and Copilot each have a FIFO lane, so the two providers may run concurrently while one provider never runs two tasks at once.
6. Successful roots are committed and cleaned up. Failed, cancelled, or interrupted roots retain their worktree for inspection.

Queued work survives a Ballet restart. Work that was running when the process exited is marked failed as interrupted and is not silently rerun.

## Project and local state

Portable, version-controlled automation remains in the checkout:

- `.ballet/project.json` — strict project configuration v7, including Loops, per-Step node styles, schedules, outputs, and agent provider/model/reasoning/network intent;
- `.ballet/theme.json` — the single project-wide Loop visualization theme;
- `.ballet/**/*.md` and `.ballet/**/*.mdx` — project documents;
- `.codex/agents/*.toml` — agent definitions and instructions; and
- `.agents/skills/**/SKILL.md` — repository skills.

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

- Configure edits repository-backed project documents, agents, skills, the single project Loop theme, Loops, Steps, Transitions, and schedules.
- Run opens the overview or a Loop/agent target, checks local provider readiness, starts persisted work, and shows immutable instructions beside the durable console or human response controls.

Agent execution keeps provider, model, reasoning effort, and network intent in `.ballet/project.json`. Provider commands and absolute read-only roots are local settings. There is no computer or runtime attachment selection because the current checkout's host is always the runtime.

## Local API

The process binds only to `127.0.0.1`. The UI uses these primary API groups:

| Purpose | Routes |
| --- | --- |
| Workspace snapshot | `GET /api/data` |
| Automation and theme | `PUT /api/automation`, `PUT /api/loop-theme` |
| Unified Runs | `POST/GET /api/runs`, `GET /api/runs/:rootRunId`, `POST /api/runs/:rootRunId/cancel` |
| Human gate | `POST /api/runs/:rootRunId/steps/:stepRunId/respond` |
| Invalidations | `GET /api/stream` |
| Console | `GET /api/execution-tasks/:taskId/events`, `GET /api/execution-tasks/:taskId/console/stream` |
| Local Runtime | runtime status/refresh/settings routes used by the Runtime view |
| Health | `GET /api/health` |

The shared invalidation stream sends workspace/Run refresh signals only. A selected task's provider-neutral console events use its dedicated cursor-resumable SSE stream.

## Security and Git behavior

- The server accepts only loopback Host values and does not grant CORS access.
- Browser mutations require the Ballet origin; originless localhost requests are reserved for the local CLI lifecycle.
- Provider processes receive no Ballet service credentials and execute only in the managed root-Run worktree.
- Run preflight binds execution to the CLI version, model, reasoning setting, policy capabilities, HEAD commit, and configuration hash observed at start.
- Source code changes block a Run. Uncommitted `.ballet`, `.codex/agents`, and `.agents/skills` changes are captured into the immutable Run snapshot instead.
- Network access defaults to off and must be enabled explicitly in portable agent intent.
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
npm test
npm run lint
npm run build
npx @google/design.md lint DESIGN.md
```

The native release smoke test additionally loads packaged `better-sqlite3`, starts the packaged server against a committed fixture checkout, verifies `.git/ballet/state.sqlite`, confirms Git remains clean, and exercises graceful shutdown.
