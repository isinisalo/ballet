---
id: adr-032
title: Graph Decision Model käyttää visuaalista reward-impact-dashboardia
status: superseded
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 2
tags:
  - arkkitehtuuripaatos
  - ui
  - reward-mdp
  - visualisointi
---

# Graph Decision Model käyttää visuaalista reward-impact-dashboardia

> **Supersession notice (2026-08-23):** `adr-033` korvaa 62-state landscape-, pulse- ja horizon-projektion 5×5/N×N Q(s,a)-matriisilla. Ihmisyksiköt sekä reward/cost/estimate-semanttiikka säilyvät.

## Konteksti

ADR-029 siirsi Graph-tason authoroinnin capability-first-kortteihin ja erilliseen Decision Model -osioon. ADR-031 rajasi osion yhden Graph-tason Reward-MDP:n factual acceptance-, transition-, reward- ja Q/V-evidenssiin. Ensimmäinen toteutus näytti kolme raw-micros-inputtia sekä 5, 304 ja 62 rivin taulukot. Sisältö oli exact, mutta käyttäjä ei nähnyt yhdellä silmäyksellä nykyistä projektiota, seuraavaa GraphNode-valintaa, palkitsevaa tai kallista siirtymää eikä priorin heikkoutta.

Projektin omistaja vaati 2026-08-23 visuaalisen, modernin ja nopeasti ymmärrettävän pinnan, jossa raskaat lomakkeet ja taulukot korvataan tilannekuvalla, reward/cost ilmaistaan värillä ja merkillä sekä suuret micros/ppm-luvut esitetään ihmisyksiköissä. PNG-konsepti hyväksyttiin toteutuksen lähtökohdaksi samalla eksplisiittisellä toteutuspyynnöllä.

## Päätösajurit

- `goal-020`, `REQ-020`, `QS-024` ja `QS-026`.
- Nykytilan, seuraavan päätöksen, acceptance-progressin ja heikon priorin yhden silmäyksen skannattavuus.
- Positiivisen ja negatiivisen transition-impactin erottaminen ilman raw-micros-laskentaa.
- Exact Reward-MDP -evidenssin, saavutettavuuden ja runtime/control-truth-rajan säilyminen.
- 1–20 GraphNode-option, bounded state catalog ja 390 px narrow -käyttö ilman sivutason vaakaylivuotoa.

## Päätös

### Ensisijainen tilannekuva

Decision Model alkaa `Decision pulse` -pinnalla. Se näyttää draftista projisoidun state-ID:n, factual acceptance-luokituksen, compiled policyn seuraavan GraphNode-option, `V(s)`-arvon reward-yksiköissä sekä priorin provenienssin. Pinta nimeää projektion draft-previewksi eikä esitä sitä live Run -tilana.

`Policy horizon` näyttää GraphNodet project configin järjestyksessä ja erottaa selected-, state-admissible-, muualla mallinnetun sekä kokonaan transition-mallittoman option. Horisontin järjestys ei ole runtime-flow eikä next-target; teksti ilmaisee, että policy voi hypätä tai palata evidenssin muuttuessa.

### Transition impact

Valitun `(state, action)`-rivin branchit esitetään visuaalisina impact-kortteina:

- leveys/progress-segmentti koodaa `probabilityPpm`:n prosenttina;
- Emerald/Secondary ja `+` sekä `reward` nimeävät positiivisen immediate rewardin;
- Error/Destructive ja `−` sekä `cost` nimeävät negatiivisen immediate rewardin;
- Tertiary ja `neutral` nimeävät nollavaikutuksen;
- `default_prior` näkyy amber-värisenä `estimate`-merkintänä eikä kalibroituna faktana;
- outcome- ja next-state-ID säilyvät exact-muodossa.

Väri ei koskaan ole ainoa semanttinen signaali. Impact lasketaan samasta ADR-031:n reward-kaavasta kuin compiler; UI ei luo vaihtoehtoista reward-semanttiikkaa.

### Policy landscape ja ihmisyksiköt

Compiled state catalog esitetään suhteellisen `V(s)`-arvon heatmapina. Tile-valinta on ephemeral inspector statea: se vaihtaa näkyvän acceptance-, Q- ja transition-evidenssin, mutta ei kirjoita draftiin, snapshotiin tai runtimeen. Current projected state ja valittu inspector state erotetaan toisistaan.

Pääpinta näyttää `micros / 1_000_000` reward-yksikköinä ja `ppm / 10_000` prosentteina. Exact integer micros ja ppm säilyvät title-/accessible detailissä, API:ssa, project configissa ja immutable snapshotissa. Näyttömuunnos ei muuta schemaa eikä persisted arvoja.

Reward-authorointi käyttää kolmea kompaktia ±1 reward-yksikön stepperiä raw-number-inputtien sijaan. Outcome-penaltyt näkyvät neutral→amber→error-spektrinä. Active Run lukitsee stepperit kuten aiemmat inputit.

### Rajat ja supersession

Ensisijaisella Decision Model -pinnalla ei ole perinteistä form-layoutia, transition-taulukkoa eikä Q/V-taulukkoa. Bounded action horizon, state heatmap ja Q-lista saavat scrollata oman panelinsa sisällä; sivutason vaakaylivuotoa ei synny. Exact-arvoja ei poisteta eikä ennustetta esitetä toteutuneena execution-faktana.

ADR-032 supersedoi ADR-029:n Graph Decision Model -osion pitkä form/matrix/table-editor -projektion. ADR-029:n capability-first Graph/GraphNode-kortit, URL-omistajuus ja protected Action Node flow säilyvät. ADR-031:n Reward-MDP-, compiler-, snapshot-, authorization- ja runtime-semanttiikka ei muutu; tämä ADR päättää vain sen authoring-projektion.

## Seuraukset

- Käyttäjä näkee projected state → selected option → branch impact → next state -ketjun ilman micros/ppm-muunnosta.
- Uusi transition-mallittamaton GraphNode ei katoa hiljaisesti, vaan näkyy `needs transition model` -tilassa.
- Heatmap tekee koko compiled policyn jakauman skannattavaksi, mutta yksittäisen tilan exact Q/V ja acceptance säilyvät tarkastettavina.
- UI tarvitsee reward-esityksen pure helperit; compiler säilyy backendin ainoana policy ownerina.
- Relative heatmap -väri ei tarkoita positiivista absolute rewardia, joten pinta nimeää asteikon suhteelliseksi long-run valueksi.

## Hylätyt vaihtoehdot

- **Raw micros/ppm pääpinnalla:** hylätty, koska suuret luvut peittävät suhteet ja lisäävät laskentakuormaa.
- **Raskaat transition- ja Q/V-taulukot collapsiblen sisällä:** hylätty ensisijaisena esityksenä, koska tavoite on yhden silmäyksen tilannekuva; exact detail säilyy tileissä ja accessible metadatassa.
- **Vapaa Sankey-/Bezier-canvas:** hylätty, koska se ei skaalaudu deterministisesti, tuo uuden shape-kielen ja voi vihjata persisted topologyyn.
- **Micros/ppm-scheman muuttaminen desimaaleiksi:** hylätty, koska deterministic exact arithmetic ja ADR-031:n snapshot-sopimus säilytetään.

## Evidenssi ja review trigger

Trace on `goal-020` / `REQ-020`, `QS-024` / `QS-026`, `adr-032`, `BB-001`, `RT-018`, `TEST-024` / `TEST-026` ja `EVID-026` / initiative `graph-reward-mdp`.

Päätös perustuu projektin omistajan eksplisiittiseen 2026-08-23 UI-uudistus- ja toteutuspyyntöön. Tekninen acceptance vaatii frontend-testit, lint/buildin, desktop 1440×900- ja narrow 390×844 -selain-QA:n, `validate:arc42`:n, DESIGN-lintin ja repositoryn final gates. Uusi ADR vaaditaan, jos visualisointi alkaa omistaa runtime-control-statea, muuttaa reward-kaavaa tai ottaa vapaan topology-editorin käyttöön.
