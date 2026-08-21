---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-21'
version: 9
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

1. **Määritellään työ** repositoryssä: Goalit, ADR:t, arc42-arkkitehtuuri, Loopit, Workflow't, Job/Validation-nodet, Pass/Fail Edget, ExecutionProfilet, instructionit, skillsit ja teema.
2. **Koostetaan provider-tehtävä** deterministisesti System-ohjeesta, primary instructionista, valituista skillseistä, roolikohtaisesta Task Envelopesta ja tulosskeemasta.
3. **Suoritetaan työnkulku** Codexilla tai Copilotilla; terminal Validation valitsee sallitun päätös/outcome-parin ja RunBook reitittää exact immutable snapshot -transitioniin. Repair call/return säilyy tästä erillisenä.
4. **Seurataan ajoa** selainkäyttöliittymästä: tila, konsolitapahtumat, hyväksytty/hylätty jatkopolku, virheet ja finalisointi.
5. **Suojataan aktiivinen checkout**: onnistunut työ commitoidaan Run-branchille ja siivotaan, muu worktree säilytetään tutkittavaksi. Ballet ei mergeä eikä pushaa automaattisesti.

## Keskeiset osat

| Osa | Tehtävä |
| --- | --- |
| React/Vite-käyttöliittymä | Configure- ja Run-työtilat, URL-ohjatut Graph Engineering / Workflow Engineering -authoring-näkymät, editorit sekä runtime- ja Run-näkymät |
| Paikallinen Express-palvelu | Loopback-API, validointi, orkestrointi, ajastus ja tapahtumavirrat |
| Provider-adapterit | Codex CLI ja GitHub Copilot CLI yhteisen tehtävä-, tapahtuma- ja tulosmallin takana |
| SQLite-tila | Root Runien, Graph/Loop/Job/Validation-roolikohtaisten Runien, State-revisioiden, jonojen, tapahtumien, tracker-outboxin ja ajastusten kestävä paikallinen historia |
| Git-eristys | Root Run -kohtainen branch ja worktree, snapshot, commitointi ja epäonnistumisten säilytys |
| Checkout-CLI | `ballet`, `stop`, `restart`, `status`, `logs`, `update` ja `version` sekä launchd-elinkaari |

## Nykytila tämän repositoryn perusteella

- Tuote on merkitty **alphaksi**, pakettiversio on **0.1.0** ja projektikonfiguraatio käyttää strict **v13** -skeemaa.
- Projektissa on **14 hyväksyttyä Goalia** ja 22 ADR-recordia, joista 20 on accepted ja kaksi superseded. ADR-022 omistaa nykyisen RunBook-rajan ja säilyttää aiempien päätösten historian.
- Paikallinen Loop Library sisältää **14 V3-pakettia**: viisi Graph Engineering -moduulia ja yhdeksän geneeristä moduulia. Package/install/export ja content-derived provenance eivät muodosta runtime-aikaista package-riippuvuutta.
- Graph Engineering näyttää yhden Orchestrator-control-noden, kompaktit Loop-kortit, DONE-terminalin ja päätös+outcome-labeloidut transitionit. Workflow Engineeringin suojattu avaruusteema säilyy selected-Loop-editorina.
- Tavallinen cross-Loop-flow on exact `(source, decision, outcome)` -RunBook-reititys. Agenttipohjaista Orchestrator-valintaa käytetään vain custom repair-edgeihin.
- Balletin oletusgraafi on DESIGN → PLAN → BUILD → DEPLOY → VERIFY, yhteensä **5 Loopia**, **17 JobNodea**, **17 ValidationNodea**, **18 transitionia** ja **0 oletus-repair-edgeä**. DESIGN toteuttaa kaikki 12 arc42-osiota omissa JobNodeissaan.
- Project-local `GraphEngineeringStateV1`, erillinen runtime `GraphOrchestrationStateV1`, Story/Release Map ja kaksi `tk`-storea erottavat bounded coordinationin, reitityksen, toimitusjärjestyksen ja toteutustaskit.
- Current hard cut on snapshot/envelope/outcome V6, composition V7, ExecutionSpec V8, runtime DB V9 ja Loop Module Package V3.
- Koodissa ovat sekä Codex- että Copilot-adapterit, scheduler, provider-kohtaiset FIFO-jonot, SQLite-palautuminen, Git-worktree-eristys ja macOS-jakelutyökalut.
- Arkkitehtuurin yhteinen entrypoint on `ARCHITECTURE.md`, ja `npm run validate:arc42` tarkistaa dokumentit, traceabilityn, resurssit ja Loop-graafin.

## Mitä puuttuu tai ei vielä näy käytössä?

**Todentamatta end-to-end:**

- `graph-engineering-runbook`-initiative on draft: strict-v13/V3/DB9-toteutus on koossa, mutta final gatejen, browser-QA:n ja ihmisacceptancen evidenssi viimeistellään ennen acceptancea.
- Ensimmäistä viiden Loopin RunBookia ei ole vielä ajettu tuotantokaltaisena end-to-end-pilottina.
- Method-healthin runtime-, transition-, repair- ja tracker-baselinet puuttuvat ensimmäiseen pilottiin asti.
- Pinnatun `tk`-revision live-smoke riippuu paikallisesta prerequisite-asennuksesta; hermetic fake-CLI-testit eivät korvaa sitä.
- Konfiguraatiossa ei ole Copilot-ExecutionProfilea tai Copilot-Nodea, vaikka platform-adapteri on toteutettu.
- Tässä checkoutissa ei ole Git-release-tagia; release/deploy/rollback edellyttää aina erillisen ihmisvaltuutuksen.

**Tarkoituksella nykyversion ulkopuolella:**

- keskitetty moniprojektihallinta, käyttäjätilit, etädaemonit ja laiteparitus;
- automaattinen merge tai push;
- Linux- ja Windows-jakelu;
- provider-fallback ja Codex/Copilotin ulkopuoliset providerit;
- remote registry, marketplace, automaattiset module-päivitykset, executable package code, Built-in-resurssikatalogi ja standalone Agent -entity;
- vaalea teema sekä keskeytyneen käynnissä olleen työn hiljainen automaattinen uudelleenajo.

## Tiivis arvio

Balletin vahvin idea ei ole “agenttien määrä”, vaan **todennettava suoritusketju**:

`versionhallittu intentio → immutable snapshot → eristetty työtila → strukturoitu tulos → pysyvä evidenssi`

Seuraava hyväksyntäraja on `graph-engineering-runbook`-initiativen `EVID-016`–`EVID-018`-ketju: final gatet, Graphin desktop/narrow-QA, Workflow-regressio ja projektin omistajan visual review. Seuraava menetelmäkypsyysaskel on rajattu viiden Loopin end-to-end-pilotti ennen erikseen päätettävää alpha-julkaisua.
