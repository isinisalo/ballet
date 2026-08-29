---
id: arc42-section-02
title: Rajoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 16
tags: [arc42, constraints]
arc42Section: 2
---

# 2. Rajoitteet

- Yksi tarkka Git-checkout ja loopback-only paikallinen palvelu muodostavat järjestelmärajan.
- Project Config v21 ja SQLite v17 ovat strict sopimuksia; vanhaa dataa ei migroida eikä lueta.
- Environment on ainoa root run. Standalone State- tai Action-ajoa ei ole.
- State `order` ja Action `priority` ovat positiivisia ja yksikäsitteisiä.
- Provider approval mode on aina `never`; verkko ja kirjoitettavat juuret tulevat hyväksytystä machine-local Agent/daemon-bindingistä ja roolista.
- Runtime ei mergeä, pushaa, releasea tai deployaa automaattisesti.
- Refinement kirjoittaa vain hyväksyttyihin instruction- ja Skill-poluihin managed worktreessä.
- UI todentuu 1440x900- ja 390x844-viewporteissa sekä keyboardilla ja reduced motionilla.
- CON-016 targetissa Project Config v21 ja SQLite v17 ovat strict, Agent binding on machine-local, yhden Runin kaikki Agentit käyttävät samaa paritettua Computeria ja remote daemon liikennöi vain HTTPS:llä (HTTP vain loopbackissa).
