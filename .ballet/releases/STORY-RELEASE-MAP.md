---
id: story-release-map
title: Local delivery evidence map
status: accepted
createdAt: '2026-08-20'
updatedAt: '2026-08-29'
version: 3
tags: [release, evidence, local]
---

# Local delivery evidence map

This map records local build, install, startup and review evidence. It does not authorize publishing, merge, push or deploy.

## Environment orchestration cutover

| Evidence stage | Owner | Acceptance |
| --- | --- | --- |
| Direction and approved Use Cases | `.ballet/project.json`, `.ballet/goals/**`, `.ballet/adr/**`, `.ballet/constraints/**`, `.ballet/use-cases/**` | strict resource validator and 13-Use-Case trace |
| Ordered delivery Environment | five State definitions and fourteen Action compositions | readiness plus order/priority and resource-reference tests |
| Runtime and governance | `TEST-028`–`TEST-030` | Validation-first, retry/block, Critic and Refinement integration evidence |
| Responsive product UI | `TEST-031` | canonical browser matrix at 1440×900 and 390×844 |
| Strict local artifact | `TEST-032` | full gates, cutover search, packaged fixture, `make latest` and startup smoke |

## Rollback boundary

Before any separately authorized external write, rollback means discarding the feature branch or checking out the pre-cutover commit and archiving/removing incompatible local state. There is no runtime database down migration.

## 2026-08-29 final local acceptance

- `npm ci`, full 267-test suite, zero-warning lint, production build, arc42/design/diff checks and the 477-file strict-cut gate passed.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `make latest` produced local artifact `ballet_0.1.0_darwin_arm64.tar.gz` with SHA-256 `be65207f4dba24da94acfe8222d4fede2c890790ef0b2a63178757d3e7ff3612`; package smoke, local install, launchd health/restart/status and stop passed.
- Nine canonical workspaces passed at 1440×900 and 390×844 with page overflow 0 and usable keyboard approval/navigation boundaries.
- The artifact was not published, and no merge, push, release publication or deploy occurred.
