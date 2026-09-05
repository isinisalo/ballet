---
id: arc42-section-02
title: Rajoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-05'
version: 20
tags: [arc42, constraints]
arc42Section: 2
---

# 2. Rajoitteet

- Yksi tarkka Git-checkout ja loopback-only paikallinen palvelu muodostavat järjestelmärajan.
- Project Config v25 ja SQLite v23 ovat strict sopimuksia; vanhaa dataa ei migroida eikä lueta.
- Environment on ainoa root run. Standalone State- tai Action-ajoa ei ole.
- State `order` ja Action `priority` ovat positiivisia ja yksikäsitteisiä.
- Provider approval mode on aina `never`; Action Agent TOML omistaa model/reasoning/instruction-arvot, governance käyttää omia Agent-TOMLejaan ja kirjoitusoikeus johdetaan roolista.
- Runtime ei mergeä, pushaa, releasea tai deployaa automaattisesti.
- Refinement kirjoittaa vain hyväksyttyyn Action/governance Agentin `developer_instructions`-muutokseen tai sallittuun instruction-/Skill-polkuun managed worktreessä.
- UI todentuu 1440x900- ja 390x844-viewporteissa sekä keyboardilla ja reduced motionilla.
- ADR-041 supersedoi State-owned Use Case -closuren: project-dokumentit pysyvät erillisenä evidenssinä, Action omistaa rooliresurssit ja valittu instruction tai Skill ohjaa tarvittavan `.ballet/**`-kontekstin lukemista.
- ADR-042 supersedoi Action-bindingin ja jaetut Action-instructionit: jokainen Action-rooli viittaa omaan TOML-agenttiin ja omiin Skilleihinsä; oikeudet johdetaan roolista.
