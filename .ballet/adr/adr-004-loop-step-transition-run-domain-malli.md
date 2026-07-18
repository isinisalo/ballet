---
id: adr-004
title: Loop, Step, Transition ja Run automaation käsitemallina
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - automaatio
  - käsitemalli
version: 1
---

# Loop, Step, Transition ja Run automaation käsitemallina

## Konteksti

Ballet tarvitsee yhden kanonisen mallin monivaiheiselle agenttityölle, ihmisen päätöksille, ajastetuille käynnistyksille ja Loopien välisille handoffeille. Mallin pitää olla sama editorissa, validoinnissa, Run-tilannekuvassa ja tilakoneessa.

## Päätös

Automaation kanoniset käsitteet ovat Loop, Step, Transition ja Run, ja ne tallennetaan `.ballet/project.json`-tiedoston tiukassa v8-muodossa.

- Loop omistaa `nodes`-taulukon ja yhden suoritettavaan nodeen viittaavan `start`-tunnisteen.
- Suoritettava node on tyypiltään `agent`, `human` tai `scheduled`.
- Agentti- ja Scheduled-Step viittaavat täsmälleen yhteen agenttiin; Human-Step ei viittaa agenttiin.
- Jokaisella suoritettavalla Stepillä on kiinteät `approved`- ja `rejected`-Transitionit.
- Transition kohdistuu paikalliseen node-ID:hen. Human-Stepin Transition voi lisäksi kohdistua eri Loopiin muodossa `{ "loop": "target-loop" }`; itseensä kohdistuva Loop-Transition ei ole sallittu.
- Jokainen Loop sisältää täsmälleen yhden kiinteätunnisteisen `completed`-, `blocked`- ja `failed`-terminaalin.
- Terminaalilla ei ole agenttia, ajastusta, outputteja eikä lähtevää Transitionia.
- Scheduled-Step saa olla vain Loopin aloitusnode, ja Loopissa saa olla enintään yksi Scheduled-Step.
- Jokainen node tallentaa itsenäisen artwork-tyylin ja koon; Route on kiinteä, tallentamaton Loop-yhteenvetoikoni.
- Yksi versionhallittu `.ballet/theme.json` määrittää kaikkien projektin Loop-canvasien yhteisen teeman.
- Jos saavutettavia agentti-Steppejä on, Root Run tallentaa käynnistyksessä suoritussuunnitelman sekä niiden agenttien ja ajoympäristöjen tilannekuvat. Kukin Loop Run tallentaa oman Loop- ja teematilannekuvansa alkaessaan.
- Ballet-repositoryn sisäänrakennettu käynnistyskäytäntö sallii Loop-kohteisen Root Runin aloituksen vain `blueprint-design`-Loopista. `milestone-planning`, `milestone-delivery` ja `release-validation` käynnistyvät Human-Transitioneista, joiden handoff validoidaan `milestone_id`- ja `github_issue`-riveinä.

## Seuraukset

- Sama validoitu v8-rakenne ohjaa editoria, ennakkotarkistusta, tilakonetta ja Run-näkymää.
- Oletus-Transitionit ovat `approved → completed` ja `rejected → blocked`.
- Ihmisen vastaus ja ajastettu käynnistys etenevät samassa tilakoneessa kuin agentin strukturoitu lopputulos.
- Loopien välinen Human-Transition luo lapsi-Loop Runin saman Root Runin sisälle ja välittää aiemman Run-syötteen sekä ihmisen vastauksen handoffina.
- Aktiivisen checkoutin myöhemmät muutokset eivät vaikuta Root Runiin. Root Runin kirjoitettavassa worktreessä tehdyt konfiguraatiomuutokset voivat vaikuttaa myöhemmin alkavan lapsi-Loopin rakenteeseen, mutta sen agentin ja ajoympäristön tilannekuvien pitää löytyä alkuperäisestä suoritussuunnitelmasta.
- Siirtymäketju on rajattava, jotta virheellinen sykli ei voi jatkua loputtomasti.
- Vanhempia projektikonfiguraatioversioita ei hyväksytä hiljaisella ajoaikaisella migraatiolla.

## Toteutuksen lähteet

- `shared/domain/automation.ts`
- `shared/api/workspace-schemas.ts`
- `backend/automation/validateAutomationConfig.ts`
- `backend/runtime/LoopRunEngine.ts`
- `backend/runs/LoopExecutionSnapshot.ts`
- `backend/services/LoopRunStartPolicy.ts`
- `shared/domain/loopHandoff.ts`
