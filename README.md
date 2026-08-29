# Ballet

Ballet is a local command center for human-directed AI work. A project owner approves Use Cases and decision context; Ballet executes them as an ordered Environment of States and Actions with Validation controlling every Work attempt.

## Core contract

- State `order` and Action `priority` are positive, unique ascending integers.
- An Environment advances only after every Action in the current State is `done`.
- Validation prechecks each Action, delegates dynamic Work when needed and postchecks the result.
- `maxRetries` is the number of additional Work attempts after the first.
- Blocking and Feedback creation are atomic.
- Critic and Refinement proposals require explicit human approval.
- Approved Refinement creates a managed-worktree commit and immutable continuation run.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DESIGN.md](DESIGN.md) for the canonical contracts.

## Run locally

```bash
npm install
npm run dev
```

The backend listens only on loopback. The UI uses canonical `/configure/*`, `/run/*`, `/feedback/*`, `/reviews/critic/*`, `/reviews/refinement/*` and `/products/*` routes; JSON/SSE endpoints live under `/api/*`.

Project truth lives in `.ballet/project.json`, `.ballet/goals`, `.ballet/adr`, `.ballet/constraints`, `.ballet/use-cases`, `.ballet/instructions` and `.agents/skills`. Runtime truth lives in a strict SQLite v16 database under `.git/ballet`. Older databases are unsupported and should be archived or removed.

Critic schedules are owned by the checkout-local service and use configured IANA timezones. A due schedule may create a read-only proposal, never an approval. Use Case, Critic and Refinement approval commands remain explicit human operations.

## CLI

```bash
npm run build
node dist-server/backend/index.js --help
```

The packaged local lifecycle is exercised with `make latest`. Release, deploy, merge and push remain human-authorized operations.

## Verify

```bash
npm run test
npm run lint
npm run build
npm run validate:arc42
npm run validate:cutover
npx @google/design.md lint DESIGN.md
git diff --check
```

The repository intentionally contains no old-data migration, compatibility route or dual-write path.
