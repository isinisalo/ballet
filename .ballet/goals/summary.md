---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-20'
version: 8
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
3. **Suoritetaan työnkulku** Codexilla tai Copilotilla; Job valmistuu paired Validationiin, PASS jatkaa Workflow'ta ja retryrajan jälkeinen FAIL eskaloituu Loop Orchestratorin allowlistattuun korjaukseen.
4. **Seurataan ajoa** selainkäyttöliittymästä: tila, konsolitapahtumat, hyväksytty/hylätty jatkopolku, virheet ja finalisointi.
5. **Suojataan aktiivinen checkout**: onnistunut työ commitoidaan Run-branchille ja siivotaan, muu worktree säilytetään tutkittavaksi. Ballet ei mergeä eikä pushaa automaattisesti.

## Keskeiset osat

| Osa | Tehtävä |
| --- | --- |
| React/Vite-käyttöliittymä | Configure- ja Run-työtilat, URL-ohjatut Graph Engineering / Workflow Engineering -authoring-näkymät, editorit sekä runtime- ja Run-näkymät |
| Paikallinen Express-palvelu | Loopback-API, validointi, orkestrointi, ajastus ja tapahtumavirrat |
| Provider-adapterit | Codex CLI ja GitHub Copilot CLI yhteisen tehtävä-, tapahtuma- ja tulosmallin takana |
| SQLite-tila | Root Runien, Loop/Job/Validation-roolikohtaisten Runien, State-revisioiden, jonojen, tapahtumien ja ajastusten kestävä paikallinen historia |
| Git-eristys | Root Run -kohtainen branch ja worktree, snapshot, commitointi ja epäonnistumisten säilytys |
| Checkout-CLI | `ballet`, `stop`, `restart`, `status`, `logs`, `update` ja `version` sekä launchd-elinkaari |

## Nykytila tämän repositoryn perusteella

- Tuote on merkitty **alphaksi**, pakettiversio on **0.1.0** ja projektikonfiguraatio käyttää strict **v12** -skeemaa.
- Projektissa on **13 hyväksyttyä Goalia** ja **20 ADR:ää**. ADR-020 supersedoi rajatusti ADR-015:n composite WorkLoopNode -mallin ja ADR-018:n Loop Engineering -nimen/reitin; Graph-, State-, Orchestrator-, Loop Module- ja project/platform-rajat säilyvät.
- Paikallinen Loop Library, yhden Loopin v2 package/install/export ja content-derived provenance on toteutettu ilman runtime-aikaista package-riippuvuutta.
- Toteutettu strict-v12 authoring-UI erottaa project-global Graph Engineeringin ja selected-Loop-only Workflow Engineeringin; Context-, compatibility-, numeric level- ja `view=loop`-reitit puuttuvat tuotantokoodista.
- Kaikki cross-Loop-flow- ja repair-valinnat kulkevat immutable snapshotin allowlist/capability-evidenssiä käyttävän Orchestrator-dispatchin kautta. Graph Engineeringin erillinen visuaalinen Orchestrator-control-node on vielä pending.
- Balletin oma kehitysautomaatio käyttää arc42 Templatea ja 6+1 Method -Loopia sekä erillistä, ketjuttamatonta `release-validation`-tukilooppia.
- Konfiguraatiossa on **20 JobNodea**, **20 yksinomaisesti paritettua ValidationNodea**, **6 Human Validation -porttia**, **6 Codex-ExecutionProfilea** ja viikoittainen continuous-learning-schedule.
- Project-local menettelyt on jaettu **10 arc42-skilliin**; execution composition ei enää käytä `migrated-*`-instructioneita.
- Koodissa ovat sekä Codex- että Copilot-adapterit, scheduler, provider-kohtaiset FIFO-jonot, SQLite-palautuminen, Git-worktree-eristys ja macOS-jakelutyökalut.
- Arkkitehtuurin yhteinen entrypoint on `ARCHITECTURE.md`, ja `npm run validate:arc42` tarkistaa dokumentit, traceabilityn, resurssit ja Loop-graafin.

## Mitä puuttuu tai ei vielä näy käytössä?

**Todentamatta end-to-end:**

- `graph-and-loop-engineering`-initiative on draft: v11-domain/schema/snapshot/module/runtime sekä authoring routing- ja Loop Engineering -osat on toteutettu ja paikallisesti todennettu; Graphin visualisoinnin Orchestrator-control-node ja ihmisacceptance ovat pending.
- `workflow-engineering`-initiative on draft: strict-v12/v2-domain-, runtime-, persistence-, API-, UI- ja repository-data-muutos on toteutettu teknisesti; lopulliset gatet ja desktop/narrow-ihmisacceptance ovat pending.
- Ensimmäistä arc42-initiativea ei ole vielä viety clarify → structures → concepts → communicate → implementation → evaluate -polun läpi.
- Method-healthin runtime-baselinet ja scheduled learning -ajon evidenssi puuttuvat ensimmäiseen pilottiin asti.
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

Seuraava hyväksyntäraja on `workflow-engineering`-initiativen `EVID-015`-ketjun teknisten gatejen ja desktop/narrow-ihmisreview'n katselmointi. Menetelmäterveyden erillinen seuraava kypsyysaskel säilyy rajattuna pilottina Root Loopilla `arc42-clarify-requirements` ennen erikseen päätettävää alpha-julkaisua.
