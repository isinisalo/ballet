---
id: arc42-section-08
title: Poikkileikkaavat konseptit
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 22
tags: [arc42, concepts]
arc42Section: 8
---

# 8. Poikkileikkaavat konseptit

| ID | Konsepti | Invariantti |
| --- | --- | --- |
| CON-015 | Validation-led immutable orchestration | project truth ja runtime truth erotetaan; snapshotit ja proposal-hashit ovat immutable; järjestys, retry, blocking ja approval toteutetaan server/SQLite-rajalla |

Status on source of truth ja `done`/`blocked` johdetaan pure-projektiona. Kaikki numerointi, canonical JSON ja hashit ovat deterministisiä. Human approval on oma trusted domain command, ei body role eikä provider-output. Refinement tarkistaa polkuallowlistin, symlinkit, preimaget, impact closuren ja result hashit ennen committia. HTTP on loopback-only, validoi requestit ja SSE kertoo vain factual invalidation/event-dataa. Accessibility, responsive layout ja design tokenit ovat contract, eivät loppuvaiheen koristelua.
