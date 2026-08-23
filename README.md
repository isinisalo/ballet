# Ballet

Ballet is a checkout-local command center for configuring and running automated AI development with Graph Engineering. Each Git checkout has its own loopback service, immutable Run snapshots, SQLite runtime state, provider queues and managed worktrees. There is no account, remote control plane or cross-project daemon.

The canonical architecture starts at [`ARCHITECTURE.md`](ARCHITECTURE.md). This README covers installation and operation; it deliberately does not duplicate the arc42 specification, accepted Goals, ADRs or [`DESIGN.md`](DESIGN.md).

## Current contract

- Project Config v18 owns one Graph, its Graph Nodes, ordered Action Nodes and one Graph-level `reward_mdp_v3` Decision Model.
- The finite discounted Reward-MDP is `(S,A,P,R,γ)` with `γ = 0.99`. It is compiled once into the immutable Root Snapshot v11; runtime projects the factual state, forms hard `A(s)` from a separate authorization snapshot and performs a policy lookup.
- Acceptance progress comes only from stable obligation IDs and Validation evidence. Project State cannot supply authorization or a numeric progress estimate.
- Each Graph Node runs its Action Nodes in array order. Each Action Node contains Work and Validation; Validation can `retry` within `maxRetries` or `escalate` a typed semantic outcome to the Graph policy.
- Task Envelope and role outcomes are v9, composition v10, ExecutionSpec v11, policy observation v4, Graph Node Module v6 and SQLite v14.
- There are no local Decision Models, scoped orchestrators, Repair Nodes, schedules, standalone Action Node Runs, compatibility readers, migrations or dual writes.

The repository default Graph has DESIGN, PLAN, BUILD, DEPLOY and VERIFY options plus a DONE terminal. At least one reachable decision state offers multiple admissible options. External writes such as merge, push, release, deploy and rollback still require exact human authorization.

## Project and local state

Version-controlled project truth remains in the checkout:

- `.ballet/project.json` — strict Project Config v18;
- `.ballet/graph-node-library/**/*.ballet-graph-node.json` — strict Graph Node Module v6 packages;
- `.ballet/instructions/**/*.md` and `.agents/skills/**/SKILL.md` — selectable prompt resources;
- `.ballet/arc42/**`, `.ballet/goals/**`, `.ballet/adr/**` and `DESIGN.md` — architecture, decisions and UI canon;
- `.ballet/releases/**` and `.tickets/**` — project-local delivery data.

Machine-local runtime state lives under `.git/ballet` and does not appear in Git status:

| Path | Contents |
| --- | --- |
| `.git/ballet/state.sqlite` | Strict SQLite v14 Run, Action Node, policy, acceptance, tracker and execution facts |
| `.git/ballet/settings.json` | Provider and optional `tk` command overrides plus read-only roots |
| `.git/ballet/service.json` | Checkout service identity and loopback port |
| `.git/ballet/worktrees/` | Root Run worktrees, including retained failures |
| `.git/ballet/logs/ballet.log` | Rotating local application log |

Schema cutovers fail closed. Pre-production databases are intentionally not migrated; after stopping Ballet, archive or remove the incompatible database and its WAL/SHM companions if their Run history is no longer needed.

## Install on macOS

Ballet supports macOS `arm64` and `x64`. Install and authenticate at least one provider CLI first. Runs also require the pinned [`tk` revision `d778bb5`](https://github.com/h2oai/tk/tree/d778bb520ee526c314c26f2bb876447e0a19caa5):

```bash
go install github.com/lo5/tk@d778bb520ee526c314c26f2bb876447e0a19caa5
```

Build, smoke-test and install the current checkout:

```bash
npm install
make latest
export PATH="$HOME/.local/bin:$PATH"
ballet version
```

`make latest` installs atomically under `${BALLET_INSTALL_PREFIX:-$HOME/.local}`, restarts only this checkout's service and prints its health. Override the prefix with `BALLET_INSTALL_PREFIX=/path make latest`.

Published releases can also be installed with Homebrew:

```bash
brew install isinisalo/tap/ballet
```

## Start Ballet

Run Ballet from the exact root of a Git checkout with at least one commit:

```bash
cd YOUR-CHECKOUT
ballet
```

Use `--no-open` to avoid opening a browser. Commands outside the launchd `PATH` can be pinned per checkout:

```bash
ballet \
  --codex-command /absolute/path/to/codex \
  --copilot-command /absolute/path/to/copilot \
  --tk-command /absolute/path/to/tk
```

The service still starts when a provider is unavailable; Runtime and Run preflight expose the exact setup or authentication issue.

## Configure and Run

Configure edits repository-backed project resources:

- Graph capabilities and its Reward Decision Model;
- Graph Nodes and their ordered Action Nodes;
- each Action Node's Work, Validation and bounded retry contract;
- ExecutionProfiles, instructions, skills and the project canvas theme;
- Graph Node Module inspect/plan/install/export/remove flows.

Run offers Graph and GraphNode roots only. A Graph Run snapshots the project, authorization, acceptance ledger, execution resources and compiled policy before dispatch. Provider output remains untrusted until the role schema and immutable semantic outcome enum accept it. Successful roots are committed; failed, cancelled or interrupted roots retain their worktree for inspection. Ballet never merges or pushes the result automatically.

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

Every lifecycle command except `version` and `help` targets the checkout at the current directory. Different clones can run simultaneously with distinct launchd labels, ports and databases.

## Local API

The process binds only to `127.0.0.1`.

| Purpose | Routes |
| --- | --- |
| Workspace snapshot | `GET /api/data` |
| Automation and theme | `PUT /api/automation`, theme routes used by Configure |
| Graph Node Modules | inspect, plan, install, export, status and remove under `/api/graph-node-modules` |
| Runs | `POST/GET /api/runs`, Run detail/state/cancel and node response routes |
| Execution evidence | task event and console stream routes |
| Runtime lifecycle | status, refresh and settings routes |
| Health | `GET /api/health` |

The shared invalidation stream carries refresh signals, never provider prose or an alternative policy decision.

## Security and Git behavior

- The server accepts loopback hosts; browser mutations require the Ballet origin.
- Imported Graph Node Modules are untrusted, size-bounded JSON. They cannot contain a local policy, peer Graph Node targets, Repair resources or executable hooks.
- Provider processes run only in the managed Root Run worktree and receive no Ballet service credentials.
- Network access defaults off and is enabled only by the selected ExecutionProfile.
- Unauthorized actions are removed from `A(s)` and cannot be dispatched. They are not converted into a soft reward penalty.
- Tracker commands run as argv arrays without a shell, against configured worktree-local stores, with timeout and output bounds.
- Queue and terminal facts are durable. Running work interrupted by restart is marked interrupted and never silently replayed.

## Development and verification

```bash
npm install
npm run dev
```

Development serves Vite on `http://127.0.0.1:5173` and the local API on its configured loopback port. Production verification uses:

```bash
npm run validate:arc42
npm run test
npm run lint -- --max-warnings=0
npm run build
npx @google/design.md lint DESIGN.md
git diff --check
make latest
```

The release smoke test loads native dependencies, starts the packaged server against the committed strict-v18 fixture, validates Graph Node Module v6 discovery and the Reward-MDP workspace through the API, checks SQLite v14 creation, confirms Git cleanliness and exercises graceful shutdown.
