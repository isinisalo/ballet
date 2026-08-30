---
id: arc42-section-12
title: Sanasto
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 26
tags: [arc42, glossary]
arc42Section: 12
---

# 12. Sanasto

| Termi | Merkitys |
| --- | --- |
| Environment | Ainoa root-run-yksikkö; sisältää ordered Statet. |
| State | Positiivisen unique `order`-arvon execution gate; sisältää priority-ordered Actionit. |
| Action | Pienin toteutusyksikkö, jonka controller on Validation ja toteutusrooli Work. |
| Action Agent | Action ID:stä ja Validation/Work-roolista johdettu Codex-agentti, jonka TOML omistaa identity-, instruction-, model- ja reasoning-totuuden. |
| Validation precheck | `done`, `delegate` tai `blocked` ennen Workia. |
| Validation postwork | `done`, `retry` tai `blocked` Workin jälkeen. |
| maxRetries | Lisä-Work-yritysten määrä ensimmäisen yrityksen jälkeen. |
| Feedback | Näkyvä, causal ja versionoitu ongelma- tai parannusevidenssi. |
| Critic proposal | Read-only arvio, joka ei ole Feedback ennen human approvalia. |
| Refinement proposal | Exact paths/diff/preimage/impact-hasheihin sidottu read-only muutosehdotus. |
| Continuation run | Uusi immutable Environment Run hyväksytyn refinement-commitin päältä. |
| Run Evidence | Terminal Runin immutable commit-, artifact-, validation- ja lineage-projektio, joka näkyy omistavan Runin sisällä. |
| Project truth | Versionhallittu direction/config/resource-data. |
| Runtime truth | SQLite v23:n statukset, eventit, päätökset, daemon-faktat ja lineage sekä Root Snapshot v20:n jäädytetty Action Agent/Skill -evidenssi. |
| Checkout-local daemon | Saman checkoutin launchd-worker, joka pollaa loopback-serveriä ja omistaa vain provider-readinessin sekä CLI-prosessit. |
