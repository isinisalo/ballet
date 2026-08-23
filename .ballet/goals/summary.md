---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-23'
version: 15
tags:
  - yhteenveto
  - tavoitteet
---

# Ballet-projektin yhteenveto

> **Ballet on yhden Git-checkoutin paikallinen komentokeskus, jolla määritellään, suoritetaan ja seurataan Codex- ja GitHub Copilot -agenttien toistettavia työnkulkuja.**

![Balletin projektikartta](./ballet-project-map.png)

## Mikä on projektin tarkoitus?

Ballet yhdistää projektin versionhallittuun automaatiomalliin kolme asiaa: **mitä tehdään**, **miten agentti suoritetaan** ja **mitä ajossa oikeasti tapahtui**. Se toimii paikallisesti macOS:ssa, pitää lähdekoodin ja tunnukset käyttäjän koneella eikä tarvitse Ballet-tiliä tai pilvipalvelua.

Tuotteen tärkein lupaus on hallittu agenttisuoritus: jokainen Root Run sidotaan Git-HEADiin ja muuttumattomaan konfiguraatiosnapshotiin, ajetaan erillisessä worktreessä ja tallennetaan jäljitettäväksi.

## Mitä Balletilla tehdään?

1. **Määritellään työ** repositoryssä: Goalit, ADR:t, arc42-arkkitehtuuri, Capability Graph, scoped Decision Modelit, GraphNodet, aggregate JobNodet, intrinsic outcomet, Work/Validation-lapset, Repair, ExecutionProfilet, instructionit, skillsit ja Job-flow-teema.
2. **Koostetaan provider-tehtävä** deterministisesti System-ohjeesta, primary instructionista, valituista skillseistä, roolikohtaisesta Task Envelopesta ja tulosskeemasta.
3. **Suoritetaan työnkulku** Codexilla tai Copilotilla; Graph ja GraphNode käyttävät explicit `agent_v1`- tai outcome-aware `ssp_v2` -strategiaa ilman fallbackia. `ssp_v2`:ssa solver valitsee GraphNoden ja JobNoden; Work→Validation ja bounded retry ovat Job Noden sisäisiä invariantteja, ja Repair palaa samaan Validationiin.
4. **Seurataan ajoa** selainkäyttöliittymästä: tila, konsolitapahtumat, hyväksytty/hylätty jatkopolku, virheet ja finalisointi.
5. **Suojataan aktiivinen checkout**: onnistunut työ commitoidaan Run-branchille ja siivotaan, muu worktree säilytetään tutkittavaksi. Ballet ei mergeä eikä pushaa automaattisesti.

## Keskeiset osat

| Osa | Tehtävä |
| --- | --- |
| React/Vite-käyttöliittymä | Capability-first Configure, scoped Decision Modelit, protected Job flow, URL-ohjatut Graph / Graph Node / Job Node -näkymät ja Current Decision / Policy Projection / Execution Graph -Run-pinnat |
| Paikallinen Express-palvelu | Loopback-API, structural draft/readiness-validointi, scoped agent/SSP v2 routing, canonical state projection ja tapahtumavirrat |
| Provider-adapterit | Codex CLI ja GitHub Copilot CLI yhteisen tehtävä-, tapahtuma- ja tulosmallin takana |
| SQLite-tila | Root Runien, GraphNode/JobNode-invocationien, work/validation/scoped-orchestrator/repair-roolien, State-revisioiden, agent-routing- ja SSP decision/observation -evidenssin, jonojen, tapahtumien ja tracker-outboxin kestävä paikallinen historia |
| Git-eristys | Root Run -kohtainen branch ja worktree, snapshot, commitointi ja epäonnistumisten säilytys |
| Checkout-CLI | `ballet`, `stop`, `restart`, `status`, `logs`, `update` ja `version` sekä launchd-elinkaari |

## Nykytila tämän repositoryn perusteella

- Tuote on merkitty **alphaksi**, pakettiversio on **0.1.0** ja Portti A:n projektikonfiguraatio käyttää strict **v16** -skeemaa.
- Projektissa on **16 hyväksyttyä ja 2 review-tilassa olevaa Goalia** sekä 29 ADR-recordia. ADR-028/029 ovat review-tilassa; ne dokumentoivat outcome-aware hierarchical policy- ja capability-first-implementationin.
- `agent_v1 | ssp_v2` ovat eksplisiittisiä strategioita Graph- ja GraphNode-scopeissa ilman fallbackia. Repositoryn default pysyy `agent_v1`:ssä, kunnes project owner hyväksyy probabilityt/costit ja pilotin.
- Paikallinen Graph Node Library sisältää **14 V5-pakettia**. Paketti sisältää intrinsic outcomet ja local agent -strategian mutta ei probabilityja, costeja, project-specific transitioneita tai upper-level appearancea.
- Graph Engineering näyttää Capability Graph -kortit ja Decision Model -osion. Graph Node näyttää Jobs-kortit ja Local Decision Model & Repair -osion. Job Node säilyttää deterministic Work/Validation industrial flow'n.
- `ssp_v2` laskee global/local Q/V-evidenssin hard-admissible actioneille. Validation palauttaa semantic outcome + PASS/FAIL:n, actual state tulee canonical projectorilta ja model miss näkyy Execution Graphissa; bounded Repair käsittelee poikkeuksen muuttamatta policya.
- Balletin oletusgraafissa on **5 GraphNodea** ja **17 aggregate JobNodea**, joilla on erilliset Work/Validation-lapset. DESIGN toteuttaa kaikki 12 arc42-osiota omissa JobNodeissaan.
- Current Portti A cut on Snapshot V9, envelope/outcome V8, composition V9, ExecutionSpec V10, runtime DB V12 ja Graph Node Module Package V5.
- Koodissa ovat sekä Codex- että Copilot-adapterit, provider-kohtaiset FIFO-jonot, SQLite-palautuminen, Git-worktree-eristys ja macOS-jakelutyökalut. Schedule-domainia tai standalone JobNode Runia ei ole.
- Arkkitehtuurin yhteinen entrypoint on `ARCHITECTURE.md`, ja `npm run validate:arc42` tarkistaa dokumentit, traceabilityn, resurssit ja strict-v16 GraphNode/strategy-graafin.

## Mitä puuttuu tai ei vielä näy käytössä?

**Todentamatta end-to-end:**

- Portti A:n implementation-, release-, startup- ja capability-first desktop/narrow/40/64-browser-evidenssi on paikallisesti koossa; projektin omistajan ADR-028/029-review ja final narrow Job-flow post-fix -kuva puuttuvat.
- Ensimmäistä viiden GraphNoden Graph Runia ei ole vielä ajettu tuotantokaltaisena end-to-end-pilottina.
- Method-healthin runtime-, transition-, repair- ja tracker-baselinet puuttuvat ensimmäiseen pilottiin asti.
- Pinnatun `tk`-revision live-smoke riippuu paikallisesta prerequisite-asennuksesta; hermetic fake-CLI-testit eivät korvaa sitä.
- Konfiguraatiossa ei ole Copilot-ExecutionProfilea tai Copilot-Nodea, vaikka platform-adapteri on toteutettu.
- Tässä checkoutissa ei ole Git-release-tagia; release/deploy/rollback edellyttää aina erillisen ihmisvaltuutuksen.

**Tarkoituksella nykyversion ulkopuolella:**

- keskitetty moniprojektihallinta, käyttäjätilit, etädaemonit ja laiteparitus;
- automaattinen merge tai push;
- Linux- ja Windows-jakelu;
- provider-fallback ja Codex/Copilotin ulkopuoliset providerit;
- remote registry, marketplace, automaattiset module-päivitykset, executable package code, Built-in-resurssikatalogi, standalone Agent -entity, schedule ja standalone JobNode Run;
- vaalea teema sekä keskeytyneen käynnissä olleen työn hiljainen automaattinen uudelleenajo.

## Tiivis arvio

Balletin vahvin idea ei ole “agenttien määrä”, vaan **todennettava suoritusketju**:

`versionhallittu intentio → immutable snapshot → eristetty työtila → strukturoitu tulos → pysyvä evidenssi`

Seuraava hyväksyntäraja on ADR-028/029:n review, capability-first desktop/narrow-QA sekä domain ownerin hyväksymä viiden GraphNoden `ssp_v2`-pilottimalli. Vasta onnistunut kokonainen pilotti ja erillinen ihmisapproval voivat valtuuttaa Portti B:n agent-routerien poiston.
