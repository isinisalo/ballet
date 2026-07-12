# Ballet

Ballet is a local-first web control plane for project automation. Runtime & Daemon v1 lets the web application start authenticated Codex CLI and GitHub Copilot CLI work on a paired Mac without moving the provider credentials into the web server.

Runtime v1 currently supports:

- macOS `arm64` and `x64` computers managed through `launchd`;
- Codex CLI `0.144.1` or newer through its app-server protocol;
- GitHub Copilot CLI `1.0.70` or newer through the Copilot SDK; and
- direct agent runs plus agent Steps inside Ballet Loops.

Each agent has one portable runtime intent (provider, model, reasoning, and network policy) plus one machine-local runtime attachment. The attachment selects the compatible computer/backend and any absolute read-only roots. Ballet never falls back to another runtime implicitly. All reachable agent Steps in one root Loop Run must resolve to the same computer.

## Runtime & Daemon v1

The web application owns scheduling and durable state. The daemon owns local provider processes and Git workspaces.

1. The web application creates an immutable task snapshot for the selected agent, runtime, model, policy, Git commit, and project configuration.
2. A paired daemon receives a WebSocket wake-up and claims the task over the authenticated daemon API.
3. The daemon verifies the exact CLI version and authentication state, prepares a run-specific Git worktree, and starts Codex or Copilot there.
4. Provider events are normalized and uploaded under a leased, fenced task claim. The UI reads the durable event stream over SSE.
5. A successful terminal root run is committed to its `ballet/run/<run-id>` branch and its worktree is removed. An unsuccessful terminal root retains its worktree for inspection.

The Runtime registry shows paired computers, connection state, source checkout, daemon diagnostics, and both provider backends. It combines heartbeat facts—configured executable, exact CLI version, authentication and health state, discovered models, and policy capabilities—with attachment and active-run counts from the control plane. The UI supports refresh, restart, logs, and disconnect; process stop remains a local CLI operation.

## Portable project configuration

The canonical automation file is [`.ballet/project.json`](.ballet/project.json). Version 5 is deliberately strict and portable: it contains Loops, their visualization themes, Step node sizes, explicit Transitions, and optional scheduled start Steps.

```json
{
  "version": 5,
  "loops": [
    {
      "id": "implementation",
      "theme": "open-ai",
      "start": "implement",
      "steps": [
        {
          "id": "implement",
          "nodeSize": "medium",
          "type": "agent",
          "agentId": "implementation-agent",
          "description": "Implement the approved task.",
          "on": {
            "approved": "review",
            "rejected": { "end": "failed" }
          }
        },
        {
          "id": "review",
          "nodeSize": "small",
          "type": "human",
          "description": "Approve the result.",
          "on": {
            "approved": { "end": "completed" },
            "rejected": "implement"
          }
        }
      ]
    }
  ]
}
```

A scheduled Loop replaces its configured start Step with a trigger and points `on.triggered` at the first executable Step. Recurring schedules keep their wall-clock time in the configured IANA time zone:

```json
{
  "id": "weekday-planning",
  "theme": "open-ai",
  "start": "weekday-start",
  "steps": [
    {
      "id": "weekday-start",
      "nodeSize": "small",
      "type": "scheduled",
      "description": "Start planning every weekday morning.",
      "schedule": {
        "kind": "recurring",
        "cadence": "weekdays",
        "startsOn": "2026-07-13",
        "time": "09:00",
        "timeZone": "Europe/Helsinki"
      },
      "on": { "triggered": "plan" }
    },
    {
      "id": "plan",
      "nodeSize": "medium",
      "type": "agent",
      "agentId": "planning-agent",
      "description": "Create the daily plan.",
      "on": {
        "approved": { "end": "completed" },
        "rejected": { "end": "failed" }
      }
    }
  ]
}
```

Scheduled runs do not add Run input; the triggered agent's saved instructions define the work. An occurrence is attempted only during its scheduled minute. Occurrences missed while the project server is stopped, or blocked by an active Run or failed preflight, are recorded and not replayed.

Runtime devices, provider commands, local paths, credentials, runs, and logs do not belong in `project.json`. Commit the portable project sources instead:

- `.ballet/project.json` for automation v5, including Loop themes and Step node sizes;
- `.ballet/runtime.json` for agent-specific provider, model, reasoning, and network intent;
- `.ballet/**/*.md` and `.ballet/**/*.mdx` for project documents;
- `.codex/agents/*.toml` for agents; and
- `.agents/skills/**/SKILL.md` for repository skills.

Machine-local and mutable execution data lives outside the repository:

| Path | Contents |
| --- | --- |
| `~/.ballet/control-plane.sqlite` | Admin/session hashes, projects, paired devices, backends, runtime attachments, task leases, agent/Loop Runs, and normalized events |
| `~/.ballet/daemon/config.json` | The active non-secret daemon, server, provider-command, and project configuration |
| `~/.ballet/projects/<project-id>/daemon.json` | Reusable project-specific pairing and daemon registration |
| `~/.ballet/daemon/status.json` | Last daemon status snapshot |
| `~/.ballet/projects/<project-id>/` | Run worktrees, locks, snapshot cache, and finalization state; the Git clone remains in its original location |
| `~/.ballet/cache/config-snapshots/` | Content-addressed snapshots of `.ballet`, `.codex/agents`, and `.agents/skills` |
| `~/Library/Logs/Ballet/` | Daemon and managed local-server logs |
| macOS Keychain | The daemon bearer token; it is not written to the daemon config or project |

Set `BALLET_HOME` to relocate daemon-managed files, `BALLET_LOG_DIR` to relocate logs, or `BALLET_CONTROL_PLANE_DB_PATH` to override the SQLite path.

## Ballet Configure and Ballet Run

The upper-left Ballet dropdown switches the whole application between **Ballet Configure** and **Ballet Run**. Configure keeps the repository-backed editors and the existing Loop canvas. Run uses `/run`, `/run/loops/:loopId?run=<rootRunId>`, and `/run/agents/:agentId?run=<rootRunId>` for launching and monitoring persisted work. Its Overview combines active roots, launch readiness, and recent runs; the detail sheet shows immutable instructions beside the selected task's durable console or human response controls. A shared invalidation stream refreshes Run lists and details, while the console stream is opened only for the selected task.

The Run read model accepts both `manual` and `schedule` sources. A Loop may use one `scheduled` start Step for a one-time or recurring calendar launch; Ballet's project-bound web server owns dispatch while the runtime daemon continues to own provider execution.

## Install on macOS

Install and authenticate the provider CLIs you intend to run. Ballet can pair while a CLI is missing, but that backend remains unavailable until its version and authentication probes pass.

### Homebrew

```bash
brew install isinisalo/tap/ballet
```

### Verified curl installer

The direct installer requires `curl`, `tar`, `shasum`, and the GitHub CLI (`gh`). It verifies both SHA-256 and the GitHub Artifact Attestation before installing the release, and fails closed if either verification fails.

```bash
curl --proto '=https' --tlsv1.2 -fsSL \
  https://raw.githubusercontent.com/isinisalo/ballet/main/scripts/install.sh | sh
```

If `/usr/local/bin` is not writable, the installer uses `~/.local/bin`; add that directory to `PATH` when prompted. Direct installs keep each verified release as an immutable bundle under `<prefix>/libexec/ballet/versions/` and atomically retarget the stable `<prefix>/bin/ballet` symlink only after the new bundle passes its version and runtime checks.

## Pair a computer

Run setup from the GitHub clone that Ballet should use. Setup resolves the Git root even when invoked from a subdirectory, starts the local web server on port `4317`, opens the one-time approval flow, and installs the daemon as a `launchd` service. It never clones or writes project configuration:

```bash
cd YOUR-REPO
ballet setup
ballet
```

For an existing Ballet server, open **Runtimes → Connect computer** and run the generated one-time command. Its shape is:

```bash
ballet setup \
  --server https://ballet.example.com \
  --app https://ballet.example.com \
  --repo git@github.com:YOUR-ORG/YOUR-REPO.git \
  --project YOUR-PROJECT-ID \
  --device-code ONE-TIME-DEVICE-CODE
```

`--server` is the daemon API origin and must use HTTPS unless it is an HTTP loopback address. `--app` is the URL opened by bare `ballet`. Ballet derives a stable project id from the current clone's GitHub origin and treats equivalent SSH and HTTPS origins as the same repository. Optional `--repo` and `--project` values verify the current checkout; they do not clone it.

Setup configures both provider backends and starts the daemon unless `--no-start` is present. If a CLI is outside the service `PATH`, pass an absolute `--codex-command` or `--copilot-command`. The pairing session moves through `pending → approved → claimed`, expires after ten minutes, and can be claimed only once.

The first local browser session asks for a single Ballet administrator password of at least 12 characters before the computer can be approved.

## CLI reference

```text
ballet
ballet stop
ballet setup [--repo <git-url>] [--server <url>] [--app <url>] [--name <device-name>]
ballet setup --server <url> --device-code <code> [--repo <git-url>] [--project <id>]
ballet update
ballet daemon start
ballet daemon stop
ballet daemon restart
ballet daemon status
ballet daemon logs [--lines N] [--follow]
ballet version
```

Useful examples:

```bash
ballet daemon status
ballet daemon logs --lines 500 --follow
ballet stop
```

Bare `ballet` binds the app to the current GitHub clone, starts the local server and an already-paired project daemon when needed, then opens the app URL. Re-running it for the same project only opens that project. Switching projects requires `ballet stop`, which cancels queued/running/waiting work, waits up to 90 seconds for terminal finalization, and only then stops the daemon and server. `ballet update` accepts only a checksum- and attestation-verified release, atomically activates a new immutable bundle for direct installs (or delegates to Homebrew), then restarts the managed local server and daemon.

## Local development

```bash
npm install
npm run dev
```

Development runs the Vite UI at `http://127.0.0.1:5173` and the Express API, control plane, and daemon WebSocket at `http://127.0.0.1:4317`. Vite proxies `/api` to port `4317`.

To run the built application on the single local origin:

```bash
npm run preview
```

Open `http://127.0.0.1:4317`. Set `BALLET_PROJECT_ROOT` when the server should load a project other than the current directory. `npm run daemon` starts the daemon in the foreground and requires an existing setup, daemon credential in macOS Keychain, and both backend entries in the daemon config. Use `npm run ballet -- --help` to run the TypeScript CLI during development.

## API groups

All HTTP paths are below `/api`.

| Group | Main routes |
| --- | --- |
| Admin | `/admin/status`, `/admin/bootstrap`, `/admin/login`, `/admin/logout` |
| Project and workspace | `/projects/active`, `/data`, `/automation`, `/project/config-status`, `/project-documents`, collection routes, `/events` |
| Runtime registry | `/runtimes/devices`, `/runtimes/devices/:deviceId/{refresh,restart,logs}` |
| Pairing UI | `/pairing/sessions`, `/pairing/sessions/:pairingId`, `/pairing/sessions/:pairingId/approve` |
| Agent execution | `/agents/execution-states`, `/agents/:agentId/runtime`, `/agents/runtime/issues`, `/agents/:agentId/runs`, `/agent-runs/:runId` |
| Unified Run model | `/runs`, `/runs/:rootRunId`, `/run-targets`, `/runs/stream` |
| Console | `/execution-tasks/:taskId/events`, `/execution-tasks/:taskId/console/stream` |
| Loop execution | `/loops/:loopId/preflight`, `/loops/:loopId/runs`, `/loop-runs/:runId/...` |
| Daemon | `/daemon/pairing/*`, `/daemon/heartbeat`, `/daemon/diagnostics`, `/daemon/tasks/*`, `/daemon/root-runs/*` |
| Daemon wake-ups | WebSocket `/api/daemon/ws` |

Except for health, admin bootstrap/status, login, and the one-time daemon pairing entry points, UI APIs require an authenticated admin session. Authenticated state-changing UI calls additionally require the CSRF token. Daemon routes and the WebSocket use the paired daemon bearer token; claimed task mutations also require the task-scoped token and current fencing value.

## Execution security and Git behavior

- Remote daemon and pairing origins require HTTPS. Only loopback origins may use plain HTTP.
- The server stores password and token digests, not daemon bearer tokens. Admin sessions use `HttpOnly`, `SameSite=Strict` cookies and CSRF validation; set `BALLET_SECURE_COOKIES=1` behind HTTPS.
- Provider child processes do not inherit Ballet daemon, control, or pairing secrets.
- Every run is bound to the exact device, backend, CLI version, model, reasoning setting, policy capability hash, Git HEAD, and project-config snapshot selected at start. Preflight fails closed when any required value is unavailable or changed.
- The source checkout must be free of code changes before a Run. Changes under `.ballet`, `.codex/agents`, and `.agents/skills` are captured into the immutable config snapshot instead of being treated as code dirt. Ballet reports these paths but never stages, commits, or pushes them.
- Providers run in the root run's managed worktree with workspace-write scope and approval escalation disabled. Writes outside that worktree are denied. Additional read-only roots are supported only when the selected backend reports that capability; Runtime v1's Codex adapter does not.
- Network access defaults to off and must be enabled explicitly in the portable runtime intent. Ballet also rejects unsafe or out-of-workspace permission requests; the provider remains responsible for enforcing the advertised sandbox capability.
- One root run reuses one locked worktree across its sequential agent Steps. Ballet never merges or pushes the result automatically. Successful roots are committed on their run branch and cleaned up; unsuccessful roots remain under `~/.ballet/projects/<project-id>/worktrees/`.
- Durable console persistence is capped at 1 MiB of non-terminal content per task while terminal protocol events are retained. The UI keeps a bounded display window, resumes by event cursor, and displays semantic reasoning summaries rather than raw private reasoning.

## Verify

The default suite is hermetic: provider-adapter tests use fixtures and do not invoke an installed Codex or Copilot CLI.

```bash
npm test
npm run lint
npm run build
```

Live provider smoke tests are opt-in because they use the locally authenticated CLI and can consume provider quota:

```bash
RUN_CODEX_SMOKE=1 npx vitest run backend/daemon/tests/liveSmoke.test.ts
RUN_COPILOT_SMOKE=1 npx vitest run backend/daemon/tests/liveSmoke.test.ts
```

Each live smoke test probes compatibility and authentication, discovers the provider's real model list, and performs one no-file-change structured-output turn. The matching CLI must be installed and authenticated; the other provider remains skipped unless its flag is also set.

Run `npx @google/design.md lint DESIGN.md` when `DESIGN.md` changes.

## Repository structure

- `frontend/` contains the React and Vite UI.
- `backend/control-plane/` contains registry, pairing, runtime-attachment, task, event, and admin persistence.
- `backend/daemon/` contains the local service, provider adapters, worktree manager, and transport.
- `backend/cli/` contains setup, update, pairing, `launchd`, project, and log commands.
- `backend/runtime/` contains durable Loop and Step Run state.
- `shared/` contains domain types and API schemas shared by the UI and server.
- `packaging/` and `scripts/` contain the release contract and verified installer.
