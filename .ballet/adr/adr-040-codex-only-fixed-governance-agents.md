---
id: adr-040
title: Codex-only kiinteät governance-agentit
status: accepted
createdAt: '2026-08-30'
updatedAt: '2026-08-30'
version: 1
tags: [arkkitehtuuripaatos, codex, governance-agent, strict-cut]
---

# Codex-only kiinteät governance-agentit

## Konteksti

Balletin yleinen Markdown Agent -rekisteri, erilliset Agent execution bindingit ja Codex/Copilot-valinta loivat tarpeettoman laajan muunneltavan suorituspinnan. Governance tarvitsee vain kaksi tunnettua roolia: immutable Run Evidenceä arvioivan Criticin ja hyväksyttyyn Feedbackiin perustuvan Refinement-proposalin tuottajan. Actionien Validation/Work-ohjaus ja continuation-semanttiikka eivät tarvitse yleistä Agent-entiteettiä.

## Päätösajurit

- Governance-identiteettien täytyy olla täsmällisiä, versionhallittuja ja palautettavissa Gitistä.
- Critic ja Refinement ovat read-only-proposal-rooleja; ihmisellä säilyy Feedback- ja apply-päätösvalta.
- Verkkoyhteys ja checkoutin ulkopuoliset read-only roots eivät saa olla konfiguroitavia.
- Actionien järjestys, Validation/Work, retry, blocked+Feedback, restart ja immutable continuation säilyvät.
- Vanhasta paikallisesta tilasta ei päätellä uusia bindingeja.

## Päätös

Balletissa on täsmälleen `ballet-critic-agent` ja `ballet-refinement-agent`. Niiden OpenAI Custom Agent -TOMLit ovat `.codex/agents/<id>.toml` ja sisältävät exact `name`-, `description`-, `developer_instructions`-, `model`-, `model_reasoning_effort`- ja `sandbox_mode = "read-only"` -kentät. Tavallinen tiedosto, ei-symlinkatut parentit, tuettu model/reasoning ja optimistic content hash validoidaan ennen lukua tai atomista tallennusta. Puuttuva tai invalidi TOML estää roolin suorittamisen; Ballet ei luo tiedostoa UI:sta.

Project Config omistaa vain roolin kiinteän `agentId`:n ja Skill-valinnat. `PUT /api/agents/:id` päivittää TOMLin developer instructions/model/reasoning -arvot ja Skill-compositionin yhtenä rollback-suojattuna operaationa. Agent POST, DELETE ja `/execution` puuttuvat. Refinement voi ehdottaa Agent-TOMLiin vain `developer_instructions`-muutosta exact preimage-hashilla; hyväksytty apply luo commitin ja uuden continuation-runin muuttamatta parent-runin Action-statusta.

Runtime- ja evidence-provider on aina Codex. Copilot-adapteri, SDK, capability/probe-polut ja provider-vaihtoehdot poistetaan. Daemon käyttää yhtä Codex-kaistaa. Action execution binding v3 sisältää vain Validation- ja Work-roolien model/reasoning-valinnat. Codex-adapteri käyttää fail-closed `networkAccess: false` -sandboxia, eikä API/UI tarjoa network- tai read-only-root-kenttiä.

Strict versiot ovat Project Config v23, Root Snapshot v18, Task Envelope/outcome v11, prompt composition v14, ExecutionSpec v16, SQLite v21, Feedback/Critic/Refinement v2, Codex Agent v2, Action execution binding v3 ja Run Evidence v1.

## Seuraukset

- Agents-UI:ssa on kaksi kiinteää navigointikohdetta, kolmipalstainen editori ja vain `Save Agent`.
- Runtimes näyttää vain Codex-faktat; provider-, network- ja roots-valinnat poistuvat Actioneista ja Agenteista.
- Invalidi tai puuttuva TOML näkyy tarkkana Git-palautusvirheenä eikä luontitoimintona.
- Parent-run, Feedback-approval ja continuation säilyvät immutableina ja ihmisohjattuina.
- SQLite v20, Config v22 ja niitä vanhemmat sopimukset hylätään ilman migraatiota.

## Hylätyt vaihtoehdot

- **Yleinen luotava Agent-rekisteri:** kasvattaisi identiteetti- ja authority-pintaa ilman nykyistä käyttötapausta.
- **Copilot- tai provider-valinta:** rikkoisi Codex-only deploymentin ja säilyttäisi poistettavan capability-matriisin.
- **Konfiguroitava network tai read-only root:** laajentaisi read-only-roolien oikeuksia ja tekisi fail-closed-oletuksesta epätarkan.
- **Parent Actionin nollaus:** muuttaisi immutable runtime-totuutta; uusi continuation-run on kanoninen uusintasuoritus.

## Supersession ja review trigger

ADR-040 supersedoi ADR-005:n provider-neutralin aktiivimallin, ADR-039:n provider/policy-bindingin sekä ADR-035/ADR-037/ADR-038-päätösten Agent-, Copilot- ja policy-osat. Niiden server-owned runtime, managed worktree, State-owned Use Case closure, Action resource composition, Feedback, Run Evidence ja continuation-osat säilyvät.

Uusi ADR vaaditaan, jos kolmas Agent, muu provider, konfiguroitava verkko/root, writable governance sandbox tai parent-runin mutaatio palautetaan. Trace: REQ-023–REQ-024, QS-039–QS-041, CON-016–CON-017, BB-016–BB-017, RT-030–RT-033, DEP-007, TEST-039–TEST-041 ja EVID-039–EVID-041.
