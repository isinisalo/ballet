# AgentOps MVP

Minimal TypeScript web application for managing projects, goals, ADRs, agents, skills, runtimes, policies, and routed event intake.

## Stack

- React + Vite for the app UI.
- Express for the local API, including `/api/events/intake`.
- JSON-file persistence at `data/db.json` for local development.
- Vitest for policy interpreter tests.

The repository was empty, so this stack was chosen as a small full-stack TypeScript default that supports both browser workflows and API event intake without external services.

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
- Policy: `Deployment failures to k8s operator`
- Routed event: `deployment.failed`
- Unassigned event: `cost.anomaly`
