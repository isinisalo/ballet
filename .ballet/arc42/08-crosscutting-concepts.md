---
id: arc42-section-08
title: Poikkileikkaavat konseptit
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 29
tags: [arc42, concepts]
arc42Section: 8
---

# 8. Poikkileikkaavat konseptit

| ID | Konsepti | Invariantti |
| --- | --- | --- |
| CON-015 | Validation-led immutable orchestration | project truth ja runtime truth erotetaan; snapshotit ja proposal-hashit ovat immutable; järjestys, retry, blocking ja approval toteutetaan server/SQLite-rajalla |
| CON-016 | Project-local Markdown and Agent truth | Markdown ja Agent TOMLit ovat projektin totuus; strict parsing, trusted provenance ja resource allowlist säilyvät. Historiallinen paired execution on korvattu CON-017:llä ja Agent-binding CON-018:lla |
| CON-017 | Checkout-local daemon boundary | serveri omistaa runtime/worktree/finalization/evidence-totuuden; daemon omistaa vain readinessin ja CLI-prosessit; vain Codex CLI, oikeudet johdetaan roolista; loopback+0600 token, checkout/config preflight, polling, lease/fencing ja idempotentti terminal outcome estävät authority driftin |
| CON-018 | Action Agent authority | TOML omistaa Action-roolin identiteetin, instructionin, modelin ja reasoningin; Project Config omistaa Skill-listan; Snapshot jäädyttää molemmat; Validation/Work-oikeudet johdetaan roolista eikä sandboxia authoroida |
| CON-019 | Shared workshop source | Shared note UUIDs and per-board placements live only in model.md; strict schema, stable serialization, atomic replacement and hash checks protect evidence; UI interaction history is ephemeral |
| CON-020 | Semantic project approval | Exact story meaning and current byte version guard an explicit trusted-human command; Markdown owns approval, Git owns history, Run gates remain independent. See [ADR-048](../adr/adr-048-four-project-views.md). |

Status on source of truth ja `done`/`blocked` johdetaan pure-projektiona. Kaikki numerointi, canonical JSON ja hashit ovat deterministisiä. Human approval on oma trusted domain command, ei body role eikä provider-output. Refinement tarkistaa polkuallowlistin, symlinkit, preimaget, impact closuren ja result hashit ennen committia. HTTP on loopback-only, validoi requestit ja SSE kertoo vain factual invalidation/event-dataa. Accessibility, responsive layout ja design tokenit ovat contract, eivät loppuvaiheen koristelua.
