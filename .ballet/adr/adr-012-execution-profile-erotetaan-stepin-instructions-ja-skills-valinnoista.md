---
id: adr-012
title: Execution profile erotetaan Stepin instructions- ja skills-valinnoista
status: accepted
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-19T06:45:37.000Z'
tags:
  - arkkitehtuuripäätös
  - execution-profile
  - step-koostaminen
version: 3
---

# Execution profile erotetaan Stepin instructions- ja skills-valinnoista

## Konteksti

Migraation lähteenä olevassa v8-mallissa Step viittaa Agentiin, Agentin TOML omistaa instructionin ja skill-valinnat sekä `.ballet/project.json.agents` omistaa providerin, modelin, reasoning effortin ja network-valinnan. Tämä kytkee yhden uudelleenkäytettävän runtime-konfiguraation Agentin workflow-sisältöön ja estää Stepiä näyttämästä omaa execution compositioniaan suoraan.

Kohdemallin pitää sallia saman runtime-konfiguraation käyttö eri tehtävissä ilman Agent-kopioita ja samalla tehdä Stepistä yksiselitteinen instructionien, skillsien, taskin ja Transitionien omistaja.

## Päätös

Tiukan v9-kohdemallin ainoa uusi authoring-entity on `ExecutionProfile`, joka sisältää vain:

- `id`
- `name`
- `provider`
- `model`
- `reasoningEffort`
- `networkAccess`

`id` on yksikäsitteinen lowercase kebab-case, `name` on non-empty käyttäjälle näkyvä nimi ja identity perustuu aina ID:hen. `executionProfiles` on lista, joka tallennetaan deterministisesti ID:n mukaiseen järjestykseen.

Agentti- ja Scheduled-Step viittaavat suoraan yhteen execution profileen ja omistavat:

- yhden `executionProfileId`-viitteen;
- täsmälleen yhden `primaryInstructionId`-viitteen;
- nollan tai useita uniikkeja `skillIds`-viitteitä;
- task descriptionin; sekä
- `approved`- ja `rejected`-kohteet.

Agent ei ole execution compositionin välikappale eikä top-level Agent kuulu v9-authoring-malliin. `agentId` ja standalone Agent Run poistuvat execution-polulta; `agent` säilyy Step-tyyppinä. Human-Stepillä ei ole execution profile-, instruction- tai skill-valintoja. Scheduled-Step käyttää samaa compositionia kuin muu agenttisuoritettava Step ja lisää nykyisen schedule-määrityksensä.

Execution profile ei saa sisältää instruction-, skill-, task-, Transition-, appearance- tai paikallista machine-policy-dataa. `workspace_access: read-only | write` arvioidaan myöhemmin erillisellä päätöksellä; sitä ei lisätä ensimmäiseen versioon, koska nykyinen worktree-, provider-policy- ja finalisointimalli olettaa kirjoitettavan workspacen.

Ensimmäiseen versioon ei lisätä Role-, Preset-, Policy-, Recipe-, Template- tai Template Pack -entityä. Origin on resurssin provenance-arvo eikä entity.

V1:n primary instructionit ratkaistaan vain eksplisiittisistä `.ballet/instructions/**/*.md` Project-resursseista ja skillsit vain `.agents/skills/**/SKILL.md` Project-resursseista. Selectable Built-in-katalogi ja clone-to-project eivät kuulu tähän versioon. `.codex/agents/*.toml` oli tämän repositoryn suoran pre-release-konversion lähde, mutta se ei jää v9:n execution-lähteeksi eikä historiallista Agent compatibility -projektiota rakenneta.

Agentin avatar-, nickname- ja live-status-metadata eivät kuulu v9 execution -malliin. Stepin nykyinen appearance säilyy. Legacy `agentReadOnlyRoots` -kentän havaitseminen estää Runin; arvoja ei poisteta tai siirretä hiljaisesti ExecutionProfileen, Stepille tai checkout-tason policyksi.

Päätös päivittää ADR-002:n, ADR-004:n, ADR-005:n, ADR-006:n ja ADR-008:n kohdat, joissa portable runtime intentio tai execution snapshot oli Agentin omistama.

## Seuraukset

- Sama execution profile voidaan deduplikoida ja valita usealle Stepille.
- Instruction- tai skill-viitteen vaihtaminen yhdessä Stepissä ei muuta samaa profilea käyttäviä muita Steppejä. Jaetun resurssin sisällön muutos vaikuttaa tarkoituksella kaikkiin siihen viittaaviin Steppeihin seuraavasta Root Runista alkaen.
- Node editor voi näyttää execution compositionin ilman provider- ja runtime-asetusten muokkausta.
- Repositoryn tracked pre-release-data muunnetaan suoraan v9:ään; runtime tukee vain strict v9:ää eikä sisällä migration-subsystemia tai v8-readeria.
- Run-suunnitelman pitää snapshotata Step composition ja execution profile erillisinä immutable-rakenteina.
- Machine-local `readOnlyRoots` ei siirry execution profileen, ja legacy `agentReadOnlyRoots` estää Runin kunnes käyttäjä tekee eksplisiittisen remediationin.

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
