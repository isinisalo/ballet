# Ballet

Minimal TypeScript web application for managing project-local agent automation as Loops, Steps, Transitions, and Runs.

## Automation model

- A **Loop** owns its ordered graph of Steps and names the Step where execution starts.
- A **Step** is handled by an agent or a human. Every Step defines explicit `approved` and `rejected` Transitions.
- An agent Step can transition only to another Step in the same Loop or to an explicit terminal state.
- A human Step can also start another Loop as a linked child Run.
- A **Run** is one immutable execution of a saved Loop snapshot. Every visit to a Step creates a distinct Step Run.
- Every Loop can be started manually. A future scheduler can use the same start service without adding a start-source field to the Loop.

The canonical automation definition is `.ballet/project.json` version 2. It contains only Loop-local Step definitions and runtimes; execution state and human responses are stored in the runtime database.

## Stack

- React + Vite for the application UI.
- Express for the local project and Loop Run API.
- Project-local JSON, TOML, YAML Frontmatter, and Markdown persistence under `.ballet`, `.codex/agents`, and `.agents/skills`.
- SQLite for Loop Runs, Step Runs, and Step logs.
- Vitest for configuration, state-machine, API, and UI behavior tests.

## Repository structure

- `frontend/` contains the React + Vite UI.
- `backend/` contains the Express API server and Loop Run engine.
- `shared/` contains domain types and API contracts shared by the UI and API.
- `backend/tests/` contains Vitest tests for backend and shared behavior.
- `data/`, `audit/`, and `.fixture-ballet-project/` contain project data, visual audit artifacts, and fixtures.

## Project-local data

Start Ballet from the project folder you want to inspect. The current working directory becomes the active project root.

Loaded project sources include:

- `.codex/agents/*.toml`
- `.agents/skills/**/SKILL.md`
- `.ballet/project.json`
- `.ballet/adr/*.md|*.mdx`
- `.ballet/goals/*.md|*.mdx`
- `.ballet/instructions/*.md|*.mdx`

Project documents and skills use YAML Frontmatter plus a Markdown body. Agent files use Codex custom-agent TOML. The UI shows exact metadata in its frontmatter-style preview and writes edits back to the project-local source.

## Edit and Run modes

Each selected Loop has URL-persistent **Edit** and **Run** modes:

- Edit changes the Loop-local Step graph. A Loop with an active Run is read-only.
- Run shows the active Run or the latest completed Run over its saved snapshot graph. Selecting a Step opens its latest StepRun and a persisted live Codex console containing agent messages, reasoning summaries, commands, stdout/stderr, file changes, tools, and terminal state.
- A manual Run accepts optional free-form input.
- A waiting human Step requires a response input and an `approved` or `rejected` result.
- Only one active Run is allowed per Loop. Runs can be cancelled, and completed Loops can be started again as new Runs.

The primary Run endpoints are:

```text
POST /api/loops/:loopId/runs
GET  /api/loops/:loopId/runs/latest
POST /api/loop-runs/:runId/steps/:stepRunId/respond
POST /api/loop-runs/:runId/cancel
GET  /api/loop-runs/:runId/steps/:stepRunId/console
GET  /api/loop-runs/:runId/steps/:stepRunId/console/stream
```

## Run locally

```bash
npm install
npm run server
```

Open `http://127.0.0.1:4174`.

For development with Vite hot reload and API proxy:

```bash
npm run dev
```

## Verify

```bash
npm test
npm run lint
npm run build
npx @google/design.md lint DESIGN.md
```

The repository project defines nine Loops: `project-brief`, `roadmap`, `ui-design`, `technical-plan`, `milestones`, `task-specs`, `implementation-review`, `dev-deployment`, and `ci-validation-recovery`. The standalone fixture project is at `.fixture-ballet-project`.
