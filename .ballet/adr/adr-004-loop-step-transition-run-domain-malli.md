---
id: adr-004
title: Loop, Step, Transition ja Run automaation käsitemallina
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - arkkitehtuuripäätös
  - automaatio
  - käsitemalli
version: 2
---

# Loop, Step, Transition ja Run automaation käsitemallina

## Konteksti

Ballet tarvitsee yhden kanonisen mallin monivaiheiselle agenttityölle, ihmisen päätöksille, ajastetuille käynnistyksille ja Loopien välisille handoffeille. Mallin pitää olla sama editorissa, validoinnissa, Run-tilannekuvassa ja tilakoneessa.

## Päätös

Automaation kanoniset käsitteet ovat Loop, Step, Transition ja Run, ja ne tallennetaan `.ballet/project.json`-tiedoston tiukassa v9-muodossa.

- Loop omistaa `nodes`-taulukon ja yhden suoritettavaan nodeen viittaavan `start`-tunnisteen.
- Suoritettava node on tyypiltään `agent`, `human` tai `scheduled`.
- Agentti- ja Scheduled-Step omistavat task descriptionin, yhden `executionProfileId`-viitteen, yhden `primaryInstructionId`-viitteen ja nollan tai useita uniikkeja `skillIds`-viitteitä. Human-Step ei sisällä execution compositionia.
- Jokaisella suoritettavalla Stepillä on kiinteät `approved`- ja `rejected`-Transitionit.
- Transition kohdistuu paikalliseen node-ID:hen. Human-Stepin Transition voi lisäksi kohdistua eri Loopiin muodossa `{ "loop": "target-loop" }`; itseensä kohdistuva Loop-Transition ei ole sallittu.
- Jokainen Loop sisältää täsmälleen yhden kiinteätunnisteisen `completed`-, `blocked`- ja `failed`-terminaalin.
- Terminaalilla ei ole agenttia, ajastusta, outputteja eikä lähtevää Transitionia.
- Scheduled-Step saa olla vain Loopin aloitusnode, ja Loopissa saa olla enintään yksi Scheduled-Step.
- Jokainen node tallentaa itsenäisen artwork-tyylin ja koon; Route on kiinteä, tallentamaton Loop-yhteenvetoikoni.
- Yksi versionhallittu `.ballet/theme.json` määrittää kaikkien projektin Loop-canvasien yhteisen teeman.
- Root Run ratkaisee ennen ensimmäistä jonotusta atomisesti kaikki käynnistyskohteesta saavutettavat Loopit, Stepit, Transitionit, ExecutionProfilet, System- ja primary instructionit, skillsit sekä teeman. Resume, retry ja Loopien välinen handoff käyttävät samaa muuttumatonta tilannekuvaa.
- Canvas ja Node editor nimeävät Stepin kaksi tulospolkua aina `Approved`- ja `Rejected`-Transitioneiksi ja näyttävät kummallekin yhden kohteen. Runtime-status ei muodosta Transitionia tai muuta edge-labelia.
- Workflow'n järjestys, käynnistyskohteet ja Loopien väliset handoffit ovat project-local dataa. Balletin tuote ei kovakoodaa repositorykohtaista roadmap-, milestone-, release- tai deploy-ketjua.

## Seuraukset

- Sama validoitu v9-rakenne ohjaa editoria, ennakkotarkistusta, tilakonetta ja Run-näkymää.
- Oletus-Transitionit ovat `approved → completed` ja `rejected → blocked`.
- Vain kanoninen `StepResult` aktivoi vastaavan Transitionin. Runtime failure, providerin `blocked`, peruutus tai `needs_input` eivät aktivoi kumpaakaan tulospolkua.
- Ihmisen vastaus ja agentin validoitu completed-outcome käyttävät samaa `approved | rejected` -tulossopimusta; ajastettu käynnistys etenee saman tilakoneen kautta.
- Loopien välinen Human-Transition luo lapsi-Loop Runin saman Root Runin sisälle ja välittää aiemman Run-syötteen sekä ihmisen vastauksen handoffina.
- Aktiivisen checkoutin tai Root Runin kirjoitettavan worktreen myöhemmät konfiguraatiomuutokset eivät muuta käynnissä olevan Root Runin rakennetta tai compositionia; ne vaikuttavat vasta seuraavaan Root Runiin.
- Siirtymäketju on rajattava, jotta virheellinen sykli ei voi jatkua loputtomasti.
- Vanhempia projektikonfiguraatioversioita ei hyväksytä hiljaisella ajoaikaisella migraatiolla.

## Toteutuksen lähteet

- `shared/domain/automation.ts`
- `shared/api/workspace-schemas.ts`
- `backend/automation/validateAutomationConfig.ts`
- `backend/runtime/LoopRunEngine.ts`
- `backend/runs/LoopExecutionSnapshot.ts`
- `backend/runs/LoopExecutionPlanner.ts`
- `shared/domain/runtime.ts`
