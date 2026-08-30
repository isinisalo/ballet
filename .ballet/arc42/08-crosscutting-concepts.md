---
id: arc42-section-08
title: Poikkileikkaavat konseptit
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 26
tags: [arc42, concepts]
arc42Section: 8
---

# 8. Poikkileikkaavat konseptit

| ID | Konsepti | Invariantti |
| --- | --- | --- |
| CON-015 | Validation-led immutable orchestration | project truth ja runtime truth erotetaan; snapshotit ja proposal-hashit ovat immutable; järjestys, retry, blocking ja approval toteutetaan server/SQLite-rajalla |
| CON-016 | Markdown Agent paired execution | Markdown/Agent on project truth, Computer/CLI binding machine-local truth ja lease/outcome runtime truth; strict parsing, same-device preflight, fencing, trusted provenance ja resource allowlist estävät authority driftin |
| CON-017 | Checkout-local daemon boundary | serveri omistaa runtime/worktree/finalization/evidence-totuuden; daemon omistaa vain readinessin ja CLI-prosessit; Validation ja subordinate Work jakavat Action-providerin ja policyn; loopback+0600 token, strict binding, polling, lease/fencing ja idempotentti terminal outcome estävät authority driftin |
| CON-018 | Action Agent authority | TOML omistaa Action-roolin identiteetin, instructionin, modelin ja reasoningin; Project Config omistaa Skill-listan; Snapshot jäädyttää molemmat; Validation/Work-oikeudet johdetaan roolista eikä sandboxia authoroida |

Status on source of truth ja `done`/`blocked` johdetaan pure-projektiona. Kaikki numerointi, canonical JSON ja hashit ovat deterministisiä. Human approval on oma trusted domain command, ei body role eikä provider-output. Refinement tarkistaa polkuallowlistin, symlinkit, preimaget, impact closuren ja result hashit ennen committia. HTTP on loopback-only, validoi requestit ja SSE kertoo vain factual invalidation/event-dataa. Accessibility, responsive layout ja design tokenit ovat contract, eivät loppuvaiheen koristelua.
