---
id: adr-041
title: Instruction-directed project context and sortable ordering
status: accepted
createdAt: '2026-08-30'
updatedAt: '2026-08-30'
version: 1
tags: [arkkitehtuuripaatos, project-context, ordering, strict-cut]
---

# Instruction-directed project context and sortable ordering

## Konteksti

Stateen tallennettu Use Case -closure teki project-local hyväksyntädokumenteista runtime-portin ja paisutti snapshotteja, task contexteja sekä authoring-UI:ta. Samalla `order` ja `priority` olivat muokattavissa sekä numeroina että erillisillä siirtokomennoilla, vaikka niiden ainoa tarkoitus on määrittää listan järjestys. Lyhyet numerokentät käyttivät koko workbenchin leveyttä.

## Päätösajurit

- Environmentin etenemisjärjestyksen täytyy säilyä yksikäsitteisenä ja palvelimen validoimana.
- Project-local Use Caset ja niiden human approval -evidenssi säilyvät ilman automaattista runtime-authorityä.
- Agentin tarvitsema projektikonteksti pitää olla valitun instructionin tai Skillin eksplisiittisesti ohjaama.
- Authoring-UI:n pitää olla tiivis, keyboard-operable ja toimia samoilla canonical API -rajoilla.
- Korvattu sopimus poistetaan strict cutina ilman migraatiota tai compatibility-readeria.

## Päätös

State sisältää vain `id`, `name`, `description`, positiivisen `order`:n ja Actionit. State tai Action ei viittaa Use Caseihin. Use Caset, niiden Markdown-dokumentit ja exact human approval säilyvät project-local evidenssinä, mutta Environment Run ei portita, snapshottaa eikä injektoi niitä task contextiin. Valitun Actionin instruction tai Skill kertoo, milloin agentti lukee tarvittavat `.ballet/goals/**`, `.ballet/adr/**`, `.ballet/constraints/**` tai `.ballet/use-cases/**` dokumentit.

`order` ja `priority` säilyvät canonical domain- ja runtime-faktoina. Ihminen muokkaa niitä vain State- ja Action-ID:t näyttävissä sortable-listoissa. Pointer drag ja keyboard-siirto tallentavat uuden järjestyksen välittömästi olemassa oleviin reorder-endpointteihin; palvelin normalisoi arvot välille `1..n`. Checkboxeja, suoria integer-kenttiä tai Earlier/Later-komentoja ei ole.

Strict versiot ovat Project Config v24, Root Snapshot v19, Task Envelope/outcome v11, prompt composition v15, ExecutionSpec v17 ja SQLite v22. Feedback/Critic/Refinement v2, Action execution binding v3, Codex Agent v2 ja Run Evidence v1 säilyvät.

## Seuraukset

- Draft, hyväksytty tai puuttuva Use Case ei yksin estä Environment Runia.
- Root Snapshot ja task context sisältävät vain Actionin suorittamiseen sidotut resurssit ja runtime-faktat; automaattista Direction-payloadia ei ole.
- Use Case CRUD, approval, hash invalidation ja project-local jäljitettävyys säilyvät.
- Config v23, Snapshot v18, prompt composition v14, ExecutionSpec v16 ja SQLite v21 hylätään ilman migraatiota.
- Lyhyet numeeriset kentät, kuten `maxRetries`, käyttävät intrinsic-leveyttä ja inline-helperiä design-sopimuksen mukaisesti.

## Hylätyt vaihtoehdot

- **State-level Use Case picker ilman runtime-closurea:** säilyttäisi kentän ilman selkeää domain-vastuuta.
- **Suora order/priority-numeroeditori:** sallisi aukot ja duplikaatit ja tekisi järjestyksestä vaikeammin hahmotettavan.
- **Pelkkä client-side reorder:** loisi rinnakkaisen totuuden eikä säilyisi reloadissa.
- **Kaikkien project-dokumenttien automaattinen prompt-injektio:** kasvattaisi kontekstia ja palauttaisi piilotetun closure-käyttäytymisen.

## Supersession ja review trigger

ADR-041 supersedoi ADR-034:n, ADR-038:n ja ADR-040:n State-owned Use Case closure-, run-gating-, snapshot- ja task-injection-osat. Niiden Environment -> State -> Action -järjestys, Validation/Work, retry, human approval, fixed Codex governance, immutable runtime ja Action resource composition säilyvät.

Uusi ADR vaaditaan, jos Use Case tai muu project-dokumentti palautetaan automaattiseksi run-portiksi/snapshot-payloadiksi, ordering-authority siirretään clientille tai järjestystä aletaan muokata sortable-listan ulkopuolelta. Trace: goal-002, goal-007 ja goal-022 / REQ-022, QS-042, CON-015, BB-015–BB-016, RT-026 ja RT-029, TEST-042 ja EVID-042.
