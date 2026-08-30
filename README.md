# Ballet

Ballet is a checkout-local command center for human-directed AI work. A human owns project direction and approvals; Ballet turns that approved intent into an ordered Environment of States and Actions. Validation controls every Action and Work executes only a bounded delegated prompt.

## Core concepts

- **Direction** keeps Goals, ADRs, Constraints and human-approved Use Cases as project-local evidence.
- **Environment** contains States with unique positive `order` values.
- **State** contains bounded Actions with unique positive `priority` values.
- **Validation** prechecks before Work and postchecks its result.
- **Runtime truth** owns Action status; `done` and `blocked` are derived, never authored in config.
- **Feedback Box** contains append-only blocked facts and human-approved Critic findings.
- **Run Evidence** is a terminal projection of canonical commit, artifact, status, approval and evidence facts.

The next State cannot start until every Action in the current State is `done`. A blocked Action gates the entire Environment.

## Setup and local start

```bash
npm ci
npm run dev
```

The service binds only to loopback. The development UI and API share one origin. To exercise the packaged local lifecycle:

```bash
make latest
ballet status
```

`make latest` builds and installs a local artifact and restarts the checkout-local service. It does not publish, merge, push or deploy.

Agent execution is performed by one checkout-local daemon. `ballet start` provisions its checkout-specific launchd config, starts the server and daemon, and waits for both to become healthy. Open `/runtimes` to inspect local status and Codex readiness or to refresh, restart and read logs. There is no Computer, provider or pairing selection step.

## Project truth layout

| Path | Ownership |
| --- | --- |
| `.ballet/project.json` | strict Project Config v24: project direction, Environment Action compositions and fixed governance composition |
| `.codex/agents/*.toml` | The two fixed read-only Codex Agent definitions for Critic and Refinement governance |
| `.ballet/goals/**` | human WHAT/WHY |
| `.ballet/adr/**` | accepted and superseded architecture decisions |
| `.ballet/constraints/**` | required and prohibited operating boundaries |
| `.ballet/use-cases/**` | human-readable approved Use Cases and approval provenance |
| `.ballet/instructions/**` | selected role instructions |
| `.agents/skills/**/SKILL.md` | selected reusable methods |
| `.ballet/arc42/**` | canonical architecture views, quality scenarios, status, trace and evidence |
| `.git/ballet/**` | machine-local SQLite v22, Action role selections, checkout-daemon state, logs and server-owned worktrees |

Project truth is version-controlled. Runtime status, attempts, leases and approvals are machine-local facts and never write back as completion flags.

## Configuration example

This abbreviated example shows the ownership boundary; the repository default contains five States, fourteen Actions and thirteen approved Use Cases.

```json
{
  "version": 22,
  "direction": {
    "goals": [{ "id": "goal-022", "name": "Human-directed orchestration", "status": "accepted" }],
    "adrs": [{ "id": "adr-034", "name": "Validation-led Environment", "status": "accepted" }],
    "constraints": [],
    "useCases": [{
      "id": "UC-07",
      "name": "Check Action readiness",
      "status": "approved",
      "examples": [{ "given": "a pending Action", "when": "Validation prechecks", "then": "it decides with evidence" }],
      "successGoals": ["Evidence before Work"],
      "failureGoals": ["No false done"],
      "expectedOutcomes": ["done, delegate or blocked"],
      "goalIds": ["goal-022"],
      "adrIds": ["adr-034"],
      "constraintIds": ["constraint-005"],
      "approval": { "approvedBy": "human-id", "approvedAt": "2026-08-29T00:00:00.000Z", "revision": 1, "contentHash": "<sha256>" }
    }]
  },
  "agents": [{
    "id": "critic",
    "name": "Critic",
    "description": "Read-only governance reviewer",
    "enabled": true,
    "instructionResource": "environment-validation",
    "skillResources": ["test-evidence-verification"]
  }],
  "environment": {
    "id": "example",
    "name": "Example",
    "description": "Ordered delivery",
    "states": [{
      "id": "verify",
      "name": "Verification",
      "description": "Verify the evidence",
      "order": 1,
      "actions": [{
        "id": "check",
        "name": "Check evidence",
        "description": "Run exact accepted checks",
        "priority": 1,
        "maxRetries": 1,
        "validation": { "instructionResource": "environment-validation", "skillResources": ["test-evidence-verification"] },
        "work": { "instructionResource": "environment-work", "skillResources": ["test-evidence-verification"] }
      }]
    }]
  }
}
```

The complete strict shape also requires Markdown-backed governance Agents, disabled-by-default Critic configuration and Refinement configuration. Validation/Work provider, model, reasoning and policy selection belong to the machine-local `actionId + role` binding, not Project Config. Inspect [`.ballet/project.json`](.ballet/project.json) for a runnable example.

## Use Case approval

Saving a draft is not approval. The human approval command binds the canonical semantic content to a SHA-256 and revision. Use Cases remain project-local evidence and do not gate an Environment Run or enter its snapshot/task context. A semantic edit invalidates the approval and returns the Use Case to draft; an agent task cannot call the approval boundary.

## Environment authoring

Author one Environment as dependency-ordered States, keep each Action small enough for independent Validation, set a bounded `maxRetries`, and select one Validation and one Work composition. State order and Action priority are persisted through their sortable ID lists. Instructions must contain Task, Role, Goals, Priorities, Method, Output contract, Tool policy and Acceptance evidence sections in that order, and must explicitly tell the agent when relevant `.ballet/**` project documents need to be read.

The default project demonstrates:

1. Direction and acceptance
2. Architecture and design
3. Implementation
4. Verification
5. Release evidence

## Validation-first execution

Validation precheck returns only `done | delegate | blocked`. `delegate` includes a specific dynamic Work prompt. Work returns only `completed | needs_input` and cannot mark the Action done. `needs_input` persists one bounded question and resumes the same Work attempt only after a human response bound to the exact Agent revision. Validation postwork returns only `done | retry | blocked`.

`maxRetries` counts additional Work attempts after the first. For example, `maxRetries: 0` permits one Work attempt and `maxRetries: 3` permits four. A provider failure is an operational failure boundary, not a silent semantic retry.

When the retry budget is exhausted, Action `blocked` and exactly one Feedback entry are committed atomically. A blocked gate prevents later work.

## Critic, Feedback and Refinement

Critic schedules support daily or weekly local times in an IANA timezone. The default schedule is disabled to avoid surprise provider cost. A due Critic reads the latest Run Evidence and creates only a proposal. Human approval appends exactly one provenance-bound Feedback entry; rejection creates none.

Refinement proposal generation is read-only. It records exact allowlisted paths, preimage/result hashes, replacement bytes, validation commands and the full reverse-impact set for shared Skills. Human approval binds the exact proposal. The platform—not an agent—applies approved bytes in a managed worktree, validates, creates one local commit and starts one immutable continuation Run. The parent Run and snapshot remain unchanged. No merge or push follows automatically.

## Canonical routes

| Workspace | UI route |
| --- | --- |
| Loop Engineering / Environment / State / Action | `/automation/loops`, `/automation/loops/states/:stateId`, `/automation/loops/states/:stateId/actions/:actionId` |
| Agents / Skills / Runtimes | `/agents`, `/skills`, `/runtimes` |
| Goals / ADRs / Constraints | `/project/goals`, `/project/adrs`, `/project/constraints` |
| Use Cases / Instructions | `/project/use-cases`, `/project/instructions` |
| Run Gate | `/run`, `/run/:runId`, nested State/Action detail |
| Feedback Box | `/feedback`, `/feedback/:id` |
| Critic / Refinement review | `/reviews/critic`, `/reviews/critic/:id`, `/reviews/refinement`, `/reviews/refinement/:id` |
| Run Evidence | inline in `/run/:runId` |

JSON commands and projections live under canonical `/api/*` routes and SSE uses `/api/events`. Key boundaries are `GET /api/project`, `GET /api/environment`, atomic Action execution binding `GET/PUT /api/environment/states/:stateId/actions/:actionId/execution`, whole-Environment `POST /api/environment-runs`, exact human Work response `POST /api/environment-runs/:runId/work-input`, Feedback commands under `/api/feedback`, human Critic decisions under `/api/critic/proposals/:id/decision`, and exact Refinement decision/apply state under `/api/refinement/proposals/:id/*`. There are no role-route aliases or standalone State/Action Run commands.

## Strict local state

The active matrix is Project Config v24, Root Snapshot v19, Task Envelope and role outcome v11, prompt composition v15, ExecutionSpec v17 and SQLite v22. Feedback, Critic, Refinement and Codex Agent are v2; Action execution binding is v3 and Run Evidence is v1. Validation and its subordinate Work agent have role-specific model/reasoning selections on the single fixed Codex runtime; network is denied and external read-only roots are not configurable. Older local databases and daemon configs are intentionally unsupported and archived or replaced during the strict cut. There is no migration or compatibility reader.

## Verification

```bash
npm run validate:arc42
npm run validate:cutover
npm run test
npm run lint -- --max-warnings=0
npm run build
npx @google/design.md lint DESIGN.md
git diff --check
```

Release/install/startup acceptance additionally runs `make latest` and browser QA at 1440×900 and 390×844. External writes, merge, push, release publication and deploy always require separate human authorization.
