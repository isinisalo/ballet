---
id: goal-012
title: Kaksitasoinen Graph Engineering ja Loop Engineering
status: accepted
createdAt: '2026-08-19T00:00:00.000Z'
updatedAt: '2026-08-19T00:00:00.000Z'
tags:
  - tavoite
  - graph-engineering
  - loop-engineering
  - orchestration
version: 1
---

# Kaksitasoinen Graph Engineering ja Loop Engineering

## Tavoite

Balletin käyttäjä suunnittelee ohjelmistokehityksen kokonaisuuden kahdessa selkeästi erotetussa authoring-näkymässä:

- **Graph Engineering** näyttää projektitason orchestration-graafin, jossa yksi `ProjectLoop` projisoidaan yhdeksi `LoopNode`-nodaksi ja `LoopOrchestrator` näkyy omana control-nodena.
- **Loop Engineering** näyttää yhden valitun LoopNoden nykyisen Level 2 -sisäisen Work/Validation-toteutuksen.

Vanha Context-canvas poistetaan kokonaan. Käyttäjän ei tarvitse ymmärtää Level 0 / Level 1 / Level 2 -terminologiaa.

## Tarkoitus

Graph Engineering tekee ohjelmistokehityksen työvaiheista itsenäisiä, uudelleenkäytettäviä ja projektitasolla koostettavia. Loop Engineering säilyttää yhden rajatun tehtävän tarkan Work/Validation-editorin.

LoopOrchestrator jakaa työn sallittujen LoopNodejen välillä. LoopNode voi eskaloida puuttuvan tiedon, kyvykkyyden tai oikeuden, mutta se ei tunne eikä nimeä korjaavaa LoopNodea. Kohteen valinta, allowlist-validaatio, continuation ja paluu kuuluvat LoopOrchestratorille ja runtimelle.

## Kyvykkyydet

- Graph Engineering on oletusnäkymä.
- Graph Engineering näyttää kaikki project-local LoopNodet sekä yhden LoopOrchestrator-noden.
- LoopNoden avaaminen siirtyy Loop Engineeringiin.
- Loop Engineering säilyttää nykyisen Level 2 -canvasin ulkoasun ja käyttäytymisen.
- ProjectLoopilla on geneerinen, koneellisesti validoitava capability-sopimus.
- Normaali cross-Loop-flow ja repair-escalation kulkevat LoopOrchestratorin päätöksen kautta.
- Repair-pyyntö ilmaisee capabilityn tai outcomen, ei target Loop ID:tä.
- Orchestrator voi valita vain immutable snapshotin ja project-global graphin salliman, capability-yhteensopivan kohteen.
- Epäselvä tai valtuutusta vaativa reitti pysähtyy `needs_input`-tilaan.
- Graph- ja Loop-näkymät ovat URL-ohjattuja, selainhistorian kanssa toimivia ja saavutettavia.

## Riippumattomuussopimus

Yksi LoopNode vastaa yhtä selkeästi nimettyä ohjelmistokehitystehtävää ja yhtä rajattua onnistumisrajaa.

LoopNoden omat Work/Validation-taskit, instructionit, skillit, State-contract, module package ja outcome eivät saa:

- nimetä peer Loop ID:tä reititysohjeena;
- valita seuraavaa tai korjaavaa Loopia;
- kirjoittaa project-global graph-topologiaa;
- myöntää itselleen uusia oikeuksia;
- olettaa tiettyä upstream- tai downstream-Loopia.

Project-global Graph ja LoopOrchestrator omistavat koostamisen ja reitityksen.

## Rajaukset

- `LoopNode` on Graph Engineeringin projektio nykyisestä `ProjectLoop`ista, ei uusi sisäkkäinen runtime-entiteetti.
- `ProjectWorkLoopNode` säilyy Loop Engineeringin sisäisenä Work/Validation-kompositiona.
- Loop Module säilyy yhden Loopin authoring/install-time artifactina.
- Platform-koodiin ei kovakoodata arc42-, UI-, implementation- tai deploy-workflow'ta.
- Ulkoiset kirjoitukset, deploy, release, merge ja push vaativat täsmällisen ihmisvaltuutuksen.
- Graph Engineering ei näytä LoopNoden sisäisiä Work/Validation-nodeja.
- Loop Engineering ei näytä project-global LoopEdgejä tai Orchestrator-nodea.
- Context-näkymää, sen reittejä tai compatibility-aliaksia ei säilytetä.

## Todentaminen

Tavoite on toteutunut, kun:

- Context-komponentti, Context-projektio, Context-reitti, Context-copy ja niitä koskeva legacy-koodi on poistettu;
- vain Graph Engineering ja Loop Engineering ovat käyttäjän valittavissa;
- Graph Engineering näyttää yhden saavutettavan LoopOrchestrator-noden ja kaikki LoopNodet;
- Loop Engineering vastaa nykyistä Level 2 -käyttäjäkokemusta ilman sisäisen domain-semanttiikan regressiota;
- runtime-testit osoittavat, että normaali cross-Loop-dispatch ja repair-dispatch validoidaan Orchestratorin kautta;
- testit osoittavat, ettei Validation tai LoopNode voi nimetä target Loop ID:tä;
- capability-yhteensopimaton tai allowlistin ulkopuolinen route hylätään;
- ambiguity ja puuttuva ihmisvaltuutus tuottavat `needs_input`-tilan;
- desktop- ja narrow viewport -kuvat osoittavat selkeän, nykyistä DESIGN.md-tyyliä noudattavan käyttöliittymän;
- `npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build` ja `git diff --check` onnistuvat.
