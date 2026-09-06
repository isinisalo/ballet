# Ballet

Ballet is a checkout-local command center for human-directed AI work. A human owns project direction and approvals; Ballet turns that approved intent into an ordered Environment of States and Actions. Validation controls every Action and Work executes only a bounded delegated prompt.

## Core concepts

- **Project** contains Overview, Event Storming, User Stories and ADRs, each backed by one canonical Markdown source.
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
| `.ballet/project.json` | strict Project Config v26: Environment, Action Agent IDs and role-specific Skill compositions |
| `.codex/agents/*.toml` | Action-specific Validation/Work definitions plus the two fixed read-only governance Agents |
| `.ballet/overview.md` | Purpose, Outcomes, Scope and Shared requirements |
| `.ballet/adr/**` | accepted and superseded architecture decisions |
| `.ballet/user-stories/<uuid>.md` | Role/Goal/Benefit, acceptance criteria, Markdown details, ADR references and exact human approval |
| `.ballet/event-storming/model.md` | shared notes and board-local process views |
| `.ballet/instructions/**` | optional generic project instructions; Action execution instructions live in Agent TOMLs |
| `.agents/skills/**/SKILL.md` | selected reusable methods |
| `.ballet/arc42/**` | canonical architecture views, quality scenarios, status, trace and evidence |
| `.git/ballet/**` | machine-local SQLite v24, checkout-daemon state, logs and server-owned worktrees |

Project truth is version-controlled. Runtime status, attempts, leases and governance approvals are machine-local facts and never write back as completion flags.

## Configuration example

This abbreviated example shows the ownership boundary; the repository default contains five States, twenty-one Actions and eight Draft User Stories awaiting explicit human approval.

```json
{
  "version": 26,
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
        "validation": { "agentId": "ballet-action-validation-check", "skillResources": ["test-evidence-verification"] },
        "work": { "agentId": "ballet-action-work-check", "skillResources": ["test-evidence-verification"] }
      }]
    }]
  },
  "critic": { "version": 2, "enabled": false, "schedules": [], "agent": { "agentId": "ballet-critic-agent", "skillResources": ["test-evidence-verification"] } },
  "refinement": { "version": 2, "enabled": true, "agent": { "agentId": "ballet-refinement-agent", "skillResources": ["safe-refinement-proposal"] }, "allowedRoots": [".codex/agents", ".ballet/instructions", ".agents/skills"] }
}
```

The complete strict shape also requires one Validation and one Work Agent TOML per Action, the two governance Agent TOMLs, disabled-by-default Critic configuration and Refinement configuration. Action Agent TOMLs own role instructions, model and reasoning; Project Config owns the fixed Agent ID and Skill list. Inspect [`.ballet/project.json`](.ballet/project.json) for a runnable example.

## User Story approval

Saving a draft is not approval. The explicit human approval command requires the saved file hash and semantic hash, then records human identity, time and revision in the story file. The semantic hash covers Role/Goal/Benefit, ordered criteria, ADR references and CommonMark details. Equivalent YAML/Markdown serialization preserves approval; stale files are rejected without discarding edits. User Stories remain project-local evidence and do not gate an Environment Run or enter its snapshot/task context. A semantic edit invalidates the approval and returns the User Story to draft; an agent task cannot call the approval boundary.

## Environment authoring

Author one Environment as dependency-ordered States, keep each Action small enough for independent Validation, set a bounded `maxRetries`, and maintain one Validation and one Work Agent with explicit Skills. State order and Action priority are persisted through their sortable ID lists. Each Action Agent's developer instructions name the Action, role, source material, exact goal, output, validation and allowed outcomes, including when relevant `.ballet/**` project documents must be read.

The default project demonstrates:

1. Event Storming
2. Arc42
3. Design
4. Build
5. Deploy

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
| Overview / Event Storming | `/project/overview`, `/project/event-storming` |
| User Stories / ADRs | `/project/user-stories`, `/project/adrs` |
| Instructions (deep link) | `/project/instructions` |
| Run Gate | `/run`, `/run/:runId`, nested State/Action detail |
| Feedback Box | `/feedback`, `/feedback/:id` |
| Critic / Refinement review | `/reviews/critic`, `/reviews/critic/:id`, `/reviews/refinement`, `/reviews/refinement/:id` |
| Run Evidence | inline in `/run/:runId` |

JSON commands and projections live under canonical `/api/*` routes and SSE uses `/api/events`. Key boundaries are `GET/PUT /api/project`, atomic Action + Agent pair operations under `/api/environment/states/:stateId/actions/:actionId`, whole-Environment `POST /api/environment-runs`, exact human Work response `POST /api/environment-runs/:runId/work-input`, Feedback commands under `/api/feedback`, human Critic decisions under `/api/critic/proposals/:id/decision`, and exact Refinement decision/apply state under `/api/refinement/proposals/:id/*`. There are no execution-binding routes or standalone State/Action Run commands.

## Strict local state

The active matrix is Project Config v26, Root Snapshot v21, Task Envelope and role outcome v11, prompt composition v16, ExecutionSpec v18 and SQLite v24. Feedback, Critic and Refinement are v2, Codex Agent is v3 and Run Evidence is v1. Validation and subordinate Work load their own TOML model/reasoning/instructions; role-derived permissions deny network and external read-only roots. Older local databases and daemon configs are intentionally unsupported and archived or replaced during the strict cut. There is no migration or compatibility reader.

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
