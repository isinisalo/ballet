# Ballet

Minimal TypeScript web application for managing projects, goals, ADRs, agents, skills, runtimes, policies, and routed event intake.

## Stack

- React + Vite for the app UI.
- Express for the local API, including `/api/events/intake`.
- Project-local TOML/Markdown persistence under `.codex/agents`, `.agents/skills`, and `.ballet/*`.
- Vitest for policy interpreter tests.

The repository was empty, so this stack was chosen as a small full-stack TypeScript default that supports both browser workflows and API event intake without external services.

## Repository Structure

- `frontend/` contains the React + Vite UI.
- `backend/` contains the Express API server.
- `shared/` contains domain types, policies, and seed data shared by the UI and API.
- `backend/tests/` contains Vitest tests for backend and shared behavior.
- `data/`, `audit/`, and `.fixture-ballet-project/` contain project data, visual audit artifacts, and fixtures.

## Project-Local Data

Start Ballet from the project folder you want to inspect. The current working directory becomes the active project root.

Loaded collections:

- `.codex/agents/*.toml`
- `.agents/skills/**/SKILL.md`
- `.ballet/project.md`
- `.ballet/adr/*.md|*.mdx`
- `.ballet/goals/*.md|*.mdx`
- `.ballet/runtimes/*.md|*.mdx`
- `.ballet/events/*.md|*.mdx`
- `.ballet/policies/*.md|*.mdx`

Project files and skills use YAML Frontmatter plus Markdown body content. Agent files use Codex custom-agent TOML. Metadata is shown in the frontmatter-style preview, and existing create/edit flows write back to the relevant project-local location.

## Run

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
npm run build
npm test
npm run lint
```

The seed data includes:

- Project: `APM · Acme Platform Migration`
- Codex CLI runtime: `codex-cli`
- Policy: `on.deployment.failed.then.k8s-operator.start.remediation`
- Routed event: `deployment.failed`
- Unassigned event: `cost.anomaly`

The Markdown fixture project is at `.fixture-ballet-project`.
