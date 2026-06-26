# Ballet

Ballet is a local TypeScript application for designing and running contract-driven agent Flows. The normal UI is organized around human-readable Flows, Runs, and Agents while the canonical project resources remain explicit contracts, routing rules, operations, emission rules, event definitions, and loop definitions.

## Stack

- React + Vite for the app UI.
- Express for the local API, including `/api/events/intake`.
- Project-local TOML/Markdown persistence under `.codex/agents`, `.agents/skills`, and `.ballet/*`.
- Vitest for Flow projection/composition, contract, mapping, routing, emission, loop, trace, and adapter tests.

## Repository Structure

- `frontend/` contains the React + Vite UI.
- `backend/` contains the Express API server.
- `backend/shared/` contains domain types, contracts, routing policies, emission policies, operations, loops, Flow view models, and seed data shared by the UI and API.
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
- `.ballet/contracts/*.md|*.mdx`
- `.ballet/operations/*.md|*.mdx`
- `.ballet/events/*.md|*.mdx`
- `.ballet/policies/*.md|*.mdx`
- `.ballet/emissions/*.md|*.mdx`
- `.ballet/loops/*.md|*.mdx`

Project files and skills use YAML Frontmatter plus Markdown body content. Agent files use Codex custom-agent TOML. New Ballet runtime resources use one canonical `apiVersion/kind/metadata/spec` frontmatter shape; there is no second writable representation.

## Runtime Model

Ballet runtime execution is contract-driven:

```text
EVENT -> ROUTING POLICY -> AGENT INPUT -> AGENT OPERATION -> AGENT OUTPUT -> EMISSION POLICY -> EVENT
```

- Event intake validates `event.data` against the active `EventDefinition.dataContract`.
- Routing policies consume exactly one event type, evaluate deterministic conditions, map event context into operation input, and validate that input against the operation input contract before queuing a run.
- Agent operations bind an agent to role-independent operation instructions plus versioned input and output contracts.
- The agent prompt contains operation instructions and mapped input only. Event IDs, event types, policy IDs, run IDs, correlation IDs, and loop metadata are not injected unless they are explicitly mapped into the input contract.
- Agent output is parsed as JSON and validated against the selected operation output contract. Runtime status uses `status: completed | blocked | needs_input | failed`; domain decisions belong under `result`.
- Emission policies observe one operation version, evaluate deterministic conditions and technical gates, map validated output into event data, validate the target event contract, and publish explicit events transactionally with run completion.
- Flows use `LoopDefinition` membership to group routing and emission policies. Runtime loop instances track correlation, hop/run counts, terminal events, and exhausted limits.

## Canonical Resources

Current Ballet resources are stored as version-aware Markdown files:

- Contracts in `.ballet/contracts`
- Operations in `.ballet/operations`
- Event definitions in `.ballet/events`
- Routing policies in `.ballet/policies`
- Emission policies in `.ballet/emissions`
- Loop definitions in `.ballet/loops`

Flows are projections over those resources. Saving a Flow creates or updates the underlying contracts, operations, routing rules, emission rules, and loop membership together; it does not create a second workflow graph.

The checked-in delivery Flow routes:

```text
plan.approved.v1
  -> developer-agent/implement-change
  -> change.implemented.v1
  -> architecture-reviewer/review-change
  -> architecture review result events

change.implemented.v1
  -> qa-verification-reviewer/verify-change
  -> QA review result events
```

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
- Contract-driven policy: `Deployment failures to k8s operator`
- Routed event: `deployment.failed`
- Unassigned event: `cost.anomaly`

The Markdown fixture project is at `.fixture-ballet-project`.
