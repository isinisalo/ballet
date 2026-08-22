---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-22'
version: 11
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

1. **Määritellään työ** repositoryssä: Goalit, ADR:t, arc42-arkkitehtuuri, Graph, GraphNodet, aggregate JobNodet, Work/Validation-lapset, scoped orchestrator/repair-candidatet, ExecutionProfilet, instructionit, skillsit ja canvas-teema.
2. **Koostetaan provider-tehtävä** deterministisesti System-ohjeesta, primary instructionista, valituista skillseistä, roolikohtaisesta Task Envelopesta ja tulosskeemasta.
3. **Suoritetaan työnkulku** Codexilla tai Copilotilla; Graph- ja Graph Node -orchestratorit valitsevat tasojen välisen dispatchin immutable snapshotin strict enumista. Work→Validation ja bounded retry ovat Job Noden sisäisiä invariantteja, ja Repair palaa samaan Validationiin.
4. **Seurataan ajoa** selainkäyttöliittymästä: tila, konsolitapahtumat, hyväksytty/hylätty jatkopolku, virheet ja finalisointi.
5. **Suojataan aktiivinen checkout**: onnistunut työ commitoidaan Run-branchille ja siivotaan, muu worktree säilytetään tutkittavaksi. Ballet ei mergeä eikä pushaa automaattisesti.

## Keskeiset osat

| Osa | Tehtävä |
| --- | --- |
| React/Vite-käyttöliittymä | Configure- ja Run-työtilat, URL-ohjatut Graph Engineering / Graph Node / Job Node -authoring-näkymät, inspectorit sekä runtime- ja Run-näkymät |
| Paikallinen Express-palvelu | Loopback-API, validointi, scoped agent routing ja tapahtumavirrat |
| Provider-adapterit | Codex CLI ja GitHub Copilot CLI yhteisen tehtävä-, tapahtuma- ja tulosmallin takana |
| SQLite-tila | Root Runien, GraphNode/JobNode-invocationien, work/validation/scoped-orchestrator/repair-roolien, State-revisioiden, routing-evidenssin, jonojen, tapahtumien ja tracker-outboxin kestävä paikallinen historia |
| Git-eristys | Root Run -kohtainen branch ja worktree, snapshot, commitointi ja epäonnistumisten säilytys |
| Checkout-CLI | `ballet`, `stop`, `restart`, `status`, `logs`, `update` ja `version` sekä launchd-elinkaari |

## Nykytila tämän repositoryn perusteella

- Tuote on merkitty **alphaksi**, pakettiversio on **0.1.0** ja projektikonfiguraatio käyttää strict **v14** -skeemaa.
- Projektissa on **15 hyväksyttyä Goalia** ja 25 ADR-recordia. ADR-023 omistaa kolmitasoisen domain/routing-rajan ja ADR-025 Job Node -authoringin industrial flow -projektion; aiempien päätösten historia säilyy.
- Paikallinen Graph Node Library sisältää **14 V4-pakettia**. Package/install/export ja content-derived provenance eivät muodosta runtime-aikaista package-riippuvuutta.
- Graph Engineering näyttää globaalin Luna-orchestratorin, optional Sol Repair Noden ja GraphNode-planeetat ilman PASS/FAIL-endpointteja. Graph Node näyttää valitun Graph Noden orchestrator/repairin ja JobNode-planeetat ilman PASS/FAIL-endpointteja. Job Node näyttää Work/Validationin deterministic industrial flow'ssa, read-only result/retry/orchestrator/exit-rakenteen ja disabled Next job -placeholderin; runtime routing ei muutu.
- Tavallinen tasojen välinen flow on scoped agent routing immutable snapshotin strict candidate-enumista. Providerin foreign target vaikuttaa nolla kertaa; bounded Repair käsittelee poikkeuksen ennen ihmiseskalaatiota.
- Balletin oletusgraafissa on **5 GraphNodea** ja **17 aggregate JobNodea**, joilla on erilliset Work/Validation-lapset. DESIGN toteuttaa kaikki 12 arc42-osiota omissa JobNodeissaan.
- Current hard cut on snapshot/envelope/outcome V7, composition V8, ExecutionSpec V9, runtime DB V10 ja Graph Node Module Package V4.
- Koodissa ovat sekä Codex- että Copilot-adapterit, provider-kohtaiset FIFO-jonot, SQLite-palautuminen, Git-worktree-eristys ja macOS-jakelutyökalut. Schedule-domainia tai standalone JobNode Runia ei ole.
- Arkkitehtuurin yhteinen entrypoint on `ARCHITECTURE.md`, ja `npm run validate:arc42` tarkistaa dokumentit, traceabilityn, resurssit ja strict-v14 GraphNode-graafin.

## Mitä puuttuu tai ei vielä näy käytössä?

**Todentamatta end-to-end:**

- `three-level-graph-node-engineering`-initiative on draft: strict-v14/V4/DB10-toteutus on työpuussa, mutta final gatejen, browser-QA:n, conformance-arvion ja ihmisacceptancen evidenssi viimeistellään ennen initiative-acceptancea.
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

Seuraava hyväksyntäraja on `three-level-graph-node-engineering`-initiativen `EVID-019`–`EVID-020`-ketju: final gatet, kolmen canvasin desktop/narrow-QA, conformance Validation ja projektin omistajan visual review. Seuraava menetelmäkypsyysaskel on rajattu viiden GraphNoden end-to-end-pilotti ennen erikseen päätettävää alpha-julkaisua.
