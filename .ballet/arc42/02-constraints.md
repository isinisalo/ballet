---
id: arc42-section-02
title: Rajoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 19
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
- CON-016 targetissa Project Config v21 ja SQLite v17 ovat strict, Agent binding on machine-local, yhden Runin kaikki Agentit käyttävät samaa paritettua Computeria ja remote daemon liikennöi vain HTTPS:llä (HTTP vain loopbackissa).
- CON-017 supersedoi CON-016:n execution placementin: daemon on checkout-kohtainen loopback-worker, bindingissä ei ole device/runtime backend -identiteettiä ja serveri omistaa SQLite/worktree/finalization/evidence-rajat.
- ADR-041 supersedoi State-owned Use Case -closuren: project-dokumentit pysyvät erillisenä evidenssinä, Action omistaa rooliresurssit ja valittu instruction tai Skill ohjaa tarvittavan `.ballet/**`-kontekstin lukemista.
- ADR-039 supersedoi ADR-038:n roolikohtaisen provider/policy-omistuksen: yksi Action-binding omistaa yhteisen providerin ja policyn, mutta model/reasoning säilyvät roolikohtaisina.
- ADR-042 supersedoi Action-bindingin ja jaetut Action-instructionit: jokainen Action-rooli viittaa omaan TOML-agenttiin ja omiin Skilleihinsä; oikeudet johdetaan roolista.
