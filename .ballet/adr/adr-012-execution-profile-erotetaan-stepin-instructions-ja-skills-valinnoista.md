---
id: adr-012
title: Execution profile erotetaan Stepin instructions- ja skills-valinnoista
status: proposed
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-18T21:21:24.000Z'
tags:
  - arkkitehtuuripäätös
  - execution-profile
  - step-koostaminen
version: 1
---

# Execution profile erotetaan Stepin instructions- ja skills-valinnoista

## Konteksti

Nykyisessä v8-mallissa Step viittaa Agentiin, Agentin TOML omistaa instructionin ja skill-valinnat sekä `.ballet/project.json.agents` omistaa providerin, modelin, reasoning effortin ja network-valinnan. Tämä kytkee yhden uudelleenkäytettävän runtime-konfiguraation Agentin workflow-sisältöön ja estää Stepiä näyttämästä omaa execution compositioniaan suoraan.

Kohdemallin pitää sallia saman runtime-konfiguraation käyttö eri tehtävissä ilman Agent-kopioita ja samalla tehdä Stepistä yksiselitteinen instructionien, skillsien, taskin ja Transitionien omistaja.

## Päätös

Jos tämä ADR hyväksytään, ensimmäisen version authoring-mallissa on erillinen `ExecutionProfile`, joka sisältää vain:

- `id`
- `name`
- `provider`
- `model`
- `reasoningEffort`
- `networkAccess`

Agentti- ja Scheduled-Step viittaavat suoraan yhteen execution profileen ja omistavat:

- yhden `executionProfileId`-viitteen;
- täsmälleen yhden `primaryInstructionId`-viitteen;
- nollan tai useita uniikkeja `skillIds`-viitteitä;
- task descriptionin; sekä
- `approved`- ja `rejected`-kohteet.

Agent ei ole execution compositionin välikappale eikä `agentId` ole kohdemallin suoritettavan Stepin pakollinen kenttä. Human-Stepillä ei ole execution profile-, instruction- tai skill-valintoja. Scheduled-Step käyttää samaa compositionia kuin muu agenttisuoritettava Step ja lisää nykyisen schedule-määrityksensä.

Execution profile ei saa sisältää instruction-, skill-, task-, Transition-, appearance- tai paikallista machine-policy-dataa. `workspace_access: read-only | write` arvioidaan myöhemmin erillisellä päätöksellä; sitä ei lisätä ensimmäiseen versioon, koska nykyinen worktree-, provider-policy- ja finalisointimalli olettaa kirjoitettavan workspacen.

Ensimmäiseen versioon ei lisätä Role-, Preset-, Policy- tai Recipe-entityä. Origin on resurssin provenance-arvo eikä entity.

Hyväksyttäessä päätös korvaa rajatusti ADR-002:n, ADR-004:n, ADR-005:n, ADR-006:n ja ADR-008:n kohdat, joissa portable runtime intentio tai execution snapshot on Agentin omistama. Näiden accepted-ADR:ien tilaa ei muuteta tämän ehdotuksen yhteydessä.

## Seuraukset

- Sama execution profile voidaan deduplikoida ja valita usealle Stepille.
- Instructionin tai skillin vaihtaminen yhdessä Stepissä ei muuta samaa profilea käyttäviä muita Steppejä.
- Node editor voi näyttää execution compositionin ilman provider- ja runtime-asetusten muokkausta.
- Agent-kokoelman, standalone Agent Runin, avatarien ja muun ei-execution-metadatan tuleva kohtalo vaatii ihmisen päätöksen ennen toteutusta.
- Projektikonfiguraatio tarvitsee eksplisiittisen, ei-hiljaisen version migrationin.
- Run-suunnitelman pitää snapshotata Step composition ja execution profile erillisinä immutable-rakenteina.
- Machine-local `readOnlyRoots` ei siirry execution profileen eikä sitä saa kadottaa hiljaisessa migrationissa.

## Toteutuksen lähteet

- `.ballet/project.json`
- `.codex/agents/*.toml`
- `shared/domain/projectConfig.ts`
- `shared/domain/automation.ts`
- `shared/domain/runtime.ts`
- `backend/runs/LoopExecutionSnapshot.ts`
- `backend/execution/RuntimeConfigurationService.ts`
- `.ballet/outputs/execution-composition/DATA-MODEL.md`
- `.ballet/outputs/execution-composition/MIGRATION-PLAN.md`
