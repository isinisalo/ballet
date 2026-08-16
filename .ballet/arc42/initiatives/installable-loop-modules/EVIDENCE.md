---
id: arc42-initiative-installable-loop-modules-evidence
title: Installable Loop modules EVIDENCE
status: draft
createdAt: '2026-08-16'
updatedAt: '2026-08-16'
version: 2
tags:
  - arc42
  - initiative
  - evidence
---

# Installable Loop modules EVIDENCE

| Evidence ID | QS/requirement | Check or observation | Artifact paths/stable IDs | Result | Timestamp/source | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| ILM-EVID-001 | QS-009 / REQ-010 | strict package/domain round-trip, malformed UTF-8/JSON/schema/size/content limits, deterministic ID mapping and State-contract compatibility | `shared/domain/loopModules.ts`, `shared/api/loop-module-schemas.ts`, `backend/tests/loopModules.test.ts` | passed | 2026-08-16 `npm run test` | schema rejects V1-unknown fields and non-false external writes; no remote source exists |
| ILM-EVID-002 | QS-002, QS-004, QS-009 | service/API/install cleanup/active Run/export closure/provenance/remove/semantic round-trip | `backend/loop-modules/**`, `backend/tests/loopModules.test.ts`, `backend/tests/loopModuleHttp.test.ts` | passed | 2026-08-16, 421 passed and 2 skipped | adopt and update are intentionally outside the minimum V1 API; install-as-new is implemented |
| ILM-EVID-003 | QS-001, QS-009 | dialog search, one-box card, safe one-confirmation install, mapping preview, import, keyboard close, focus and narrow viewport classes | `LoopLibraryDialog.tsx`, `frontend/tests/loopLibraryUi.test.tsx` | passed | 2026-08-16 `npm run test` | browser-level visual regression is not part of the current repository harness |
| ILM-EVID-004 | QS-005, QS-009 | seven independently parseable arc42 packages, arc42 contract validation, production build and final-archive server/library smoke | `.ballet/loop-library/arc42/**`, `.fixture-ballet-project/.ballet/loop-library/**`, `scripts/build-release.sh` | passed | 2026-08-16 `npm run validate:arc42`, `npm run build`, `npm run release:build -- 0.1.0-loop-modules-final-check arm64 /tmp/ballet-loop-module-release-final-check.XO5D8Y` | local unsigned test archive only; nothing published |
| ILM-EVID-005 | QS-009 | full tests, lint, build, design lint, platform boundary scan, diff check and bounded conformance review | repository diff, Goal-010, ADR-016, REQ-010, CON-007, BB-009, RT-006/RT-007 | passed; approved with notes | 2026-08-16 local | ESLint has no errors and 11 non-blocking size/complexity warnings; design lint has one pre-existing `controls` schema warning |

## Check totals and release evidence

- `npm run test`: 85 files passed, 1 skipped; 421 tests passed, 2 skipped.
- `npm run validate:arc42`: 12 sections, 29 unique document IDs, 8 Loops and 35 Loop Edges.
- `npm run lint`: zero errors; 11 warnings.
- `npm run build`: production TypeScript and Vite build passed.
- `npx @google/design.md lint DESIGN.md`: zero errors; the unchanged frontmatter `controls` key produces one warning.
- release smoke SHA-256: `a890a0ec7d85664ca9012cdb05538bfc47db42408945c636ef1b05568dba17e2`.

## Open questions

No blocking conformance question remains. Remote distribution/update policy and optional exact adopt remain later, separately authorized work.
