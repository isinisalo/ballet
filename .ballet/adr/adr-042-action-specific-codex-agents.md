---
id: adr-042
title: Action-kohtaiset Codex-agentit ovat suoritusohjeen totuus
status: accepted
createdAt: '2026-08-30'
updatedAt: '2026-08-30'
version: 1
tags: [arkkitehtuuripaatos, codex, action-agent, strict-cut]
---

# Action-kohtaiset Codex-agentit ovat suoritusohjeen totuus

## Konteksti

Actionien jaetut Validation- ja Work-instructionit sekä erillinen machine-local model/reasoning-binding tekivät eri Actioneista käytännössä saman agenttityön. Action on Balletissa itsenäinen delegointiraja, joten sen kummankin roolin identiteetin, ohjeen ja suoritusprofiilin pitää olla täsmällinen, versionhallittu ja immutableen Runiin jäädytettävä.

## Päätös

Jokaisella Actionilla on kaksi Action ID:stä johdettua Codex-agenttia: `ballet-action-validation-<action-id>` ja `ballet-action-work-<action-id>`. Niiden tavalliset, ei-symlinkatut TOMLit sijaitsevat `.codex/agents/`-hakemistossa ja sisältävät täsmälleen `name`, `description`, `developer_instructions`, `model` ja `model_reasoning_effort`. Project Configin Action-rooli sisältää `{ agentId, skillResources }`; instruction-resourcea tai rinnakkaista execution bindingia ei ole.

Validation-agentti on read-only controller ja voi palauttaa vain `done | delegate | blocked`. Work-agentti toimii vain Validationin rajaamalla dynaamisella promptilla serverin managed worktreessä. Oikeudet johdetaan roolista, eikä Action-agentin TOML saa määrittää sandboxia. Codex-runtimen pitää tukea valittua model/reasoning-yhdistelmää ennen Runia.

Root Snapshot jäädyttää jokaisen Action-agentin koko määritelmän, TOML-hashin ja valitun Skill-closuren. Promptin ensisijainen ohje tulee kyseisen agentin `developer_instructions`-kentästä. Project Configin ja Actionin kahden TOMLin create/update/delete on rollback-suojattu atominen kokonaisuus, käyttää optimistic hasheja ja on lukittu aktiivisen Runin aikana.

Refinement voi ehdottaa vain olemassa olevan Action-agentin `developer_instructions`-kentän muutosta exact preimage/change/impact-hasheilla. `name`, `description`, `model` ja `model_reasoning_effort` säilyvät ihmisen authoring-vastuulla. Kaksi ADR-040:n governance-agenttia ja niiden read-only-sandbox-säännöt säilyvät ennallaan; `/agents` hallitsee vain niitä.

Strict versiot ovat Project Config v25, Root Snapshot v20, Task Envelope/outcome v11, prompt composition v16, ExecutionSpec v18, SQLite v23, Codex Agent v3, Feedback/Critic/Refinement v2 ja Run Evidence v1. Action execution binding poistetaan ilman migraatiota tai compatibility-readeria.

## Seuraukset

- Balletin oletusprojektissa on 21 Actionia ja täsmälleen 42 yksilöllistä Action-agentti-TOMLia sekä kaksi governance-agenttia.
- Action Workspace muokkaa Action-määritystä, kummankin roolin agenttia ja erillisiä Skill-listoja yhdellä atomisella tallennuksella; instruction-dropdownia tai machine-local execution-editoria ei ole.
- Puuttuva, ylimääräinen, invalidi, symlinkattu, väärän niminen tai duplikaatti-instructionin sisältävä Action-agentti estää preflightin.
- Uusi Action saa kaksi omaa starter-agenttia eikä kopioi toisen Actionin ohjetta. Actionin tai Staten poisto poistaa myös omistetut agentit tai palauttaa kaikki tiedostot ennalleen.

## Hylätyt vaihtoehdot

- **Jaetut phase-instructionit:** eivät anna jokaiselle Actionille itsenäistä tavoitetta, tuotosta ja hyväksyntää.
- **Machine-local Action binding:** loisi TOMLin rinnalle toisen model/reasoning-totuuden.
- **Sandbox TOMLissa:** tekisi oikeuksista authoroitavan, vaikka niiden pitää seurata Validation/Work-roolia.
- **Action-agentit `/agents`-rekisterissä:** sekoittaisi Actionin omistamat agentit governance-agenttien hallintaan.

## Supersession ja review trigger

ADR-042 supersedoi ADR-040:n, ADR-038:n ja ADR-035:n Action-instruction-, Action-agentti- ja Action execution binding -osat. ADR-040:n Critic/Refinement-governance, Codex-only daemon, verkon kielto ja ihmisen päätösvalta säilyvät.

Uusi ADR vaaditaan, jos Action-agentin identiteetti ei enää johdu Actionista ja roolista, sandbox muuttuu authoroitavaksi, rinnakkainen model/reasoning-totuus palautetaan, governance-agentit yhdistetään Action-agentteihin tai Refinement saa muuttaa muita TOML-kenttiä. Trace: QS-043, CON-018, BB-018, RT-034, DEP-008, TEST-043 ja EVID-043.
