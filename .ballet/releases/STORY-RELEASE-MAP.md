---
id: story-release-map
title: Local delivery evidence map
status: accepted
createdAt: '2026-08-20'
updatedAt: '2026-08-29'
version: 2
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
