---
id: adr-023
title: Kolmitasoinen Graph Node -domain ja agenttiohjattu reititys
status: accepted
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-22T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - graph-node
  - orchestrator
  - repair
version: 1
---

# Kolmitasoinen Graph Node -domain ja agenttiohjattu reititys

## Konteksti

Strict-v13 mallinsi project-global-rakenteen `ProjectLoop`eina, niiden sisäisen rakenteen erillisenä Workflow'na ja tavallisen flow'n deterministic named transitioneina. Käyttäjän haluama mentaalimalli on kuitenkin yksi sisäkkäinen `Graph → GraphNode → JobNode → Work/Validation` -rakenne, jossa orchestrator tekee kaikki tasojen väliset reitityspäätökset. Kaksi rinnakkaista Graph/Workflow-käsitettä, persisted child-to-child Edget ja schedule-domain lisäsivät selitystä ilman, että ne olivat uuden rakenteen välttämättömiä primitivejä.

Reitityksessä tarvitaan kustannustehokas, suuren volyymin oletus ja kyvykkäämpi poikkeuspolku. Käyttäjä hyväksyi 2026-08-22 strict hard cutin, Luna-tyylisen orchestratorin sekä valinnaisen Sol-tyylisen Repair Noden. Mallivalinta kuuluu Balletin project-local `ExecutionProfile`-dataan, ei platformin ohjauslogiikkaan.

## Päätös

### Yksi sisäkkäinen domain

Project config v14:n `graph` omistaa nimen, yhteisen initial Staten, Graph Orchestratorin, valinnaisen Repair Noden ja 1–40 `ProjectGraphNodea`. Graph Node omistaa identiteetin, appearance-arvot, capability-/State-contractin, Graph Node Orchestratorin, valinnaisen Repair Noden ja 1–64 `ProjectJobNodea`.

Job Node on black-box-aggregaatti, joka omistaa appearance-arvonsa, capabilityt, `maxRetries`-rajan sekä täsmälleen yhden `workNode`- ja yhden `validationNode`-lapsen. Work on `agent | human`; schedule-domainia ei ole. Work ja Validation omistavat kolmannen tason artworkinsa eikä Validationia voi jakaa tai irrottaa Job Nodesta.

### Orchestrator omistaa tasojen välisen reitityksen

Graph- ja Graph Node -orchestratorit omistavat ExecutionCompositionin, rajat sekä authoroidut `start`, `continuation` ja `repair` candidate-säännöt. Runtime kutsuu Graph Orchestratoria Graph Runin alussa ja jokaisen GraphNode-tuloksen jälkeen. Graph Node Orchestratoria kutsutaan GraphNode-ajon alussa ja jokaisen JobNode-tuloksen jälkeen.

Provider saa vain tilanteeseen sopivan snapshotatun strict enumin: dispatch sallittuun childiin, terminaali `PASS | FAIL`, delegate Repair Nodelle tai `needs_input`. Invalidi tai out-of-snapshot-target vaikuttaa canonical control flow'hun nolla kertaa. Runtime yrittää orchestratoria enintään kolme kertaa ennen saman tason Repair Nodea.

Job Noden sisäiset Work → Validation ja Validation FAIL → Work retry ovat ainoat kiinteät reitit. Retryrajan jälkeen Graph Node Orchestrator valitsee repairin tai eskalaation. Repair saa muuttaa vain Run-worktreen artefakteja ja validoitua Statea, minkä jälkeen se palaa durable LIFO-framella samaan Validationiin uusimmalla Statella ajamatta Workia uudelleen tai nollaamatta retryä. Paikallinen Repair voi eskaloida Graph-tasolle; Graph Repairin jälkeen viimeinen raja on ihmisen `needs_input`.

Repair attempts ja depth ovat oletuksena enintään 3 ja orchestrator transition count enintään 256. Aktiivisen immutable snapshotin candidate-joukkoa, profiileja, oikeuksia tai resource closurea ei voi laajentaa.

### Roolikohtaiset outcomet ja Run-rajat

- Work palauttaa `completed | needs_input | blocked | failed`, artefaktit ja valinnaisen State patchin.
- Validation palauttaa `PASS | FAIL`, evidenssin ja FAIL-korjauspyynnön ilman target-ID:tä.
- Orchestrator palauttaa child-dispatchin, terminalin, Repair-delegoinnin tai `needs_input`-tuloksen.
- Repair palauttaa korjauksen ja same-Validation-returnin, sallitun repair-dispatchin tai ylemmän tason eskalaation.

Julkiset Run-rajat ovat Graph Run ja GraphNode Run. Standalone JobNode Runia ei ole. GraphNode Run voi käyttää ylempää Graph Orchestratoria vain repair-eskalaatioon, ei normaaliin Graph-continuationiin.

### Versionointi, persistence ja moduulit

Strict hard cut nostaa project configin v14:ään, Graph Node Module Packagen v4:ään, Root Snapshotin v7:ään, Task Envelope/outcomen v7:ään, compositionin v8:aan, ExecutionSpecin v9:ään ja SQLite scheman v10:een. Compatibility-readereita, aliaksia, dual-writeä tai automaattista runtime-migraatiota ei ole.

SQLite v10 käyttää GraphNode- ja JobNode-invocationeja sekä erottaa `work`, `validation`, scoped `orchestrator` ja scoped `repair` -roolit. Request-, decision- ja frame-evidenssi on geneerinen. Schema v9 jää koskemattomaksi ja startup failaa suljetusti archive/remediation-ohjeella.

Graph Node Module v4 sisältää yhden Graph Noden, sen Jobit, orchestratorin, valinnaisen Repair Noden ja resource closuren. Peer-GraphNode-targetit kuuluvat vain project-global candidate-sääntöihin. Blank-authoring ja import vaativat näkyvän profile/instruction-mappingin ilman hiljaista ensimmäisen profiilin valintaa.

### Malliprofiilit

Balletin oletusprojekti käyttää globaalissa ja jokaisessa paikallisessa orchestratorissa `gpt-5.6-luna` / medium / network-off -profiilia sekä Repair Nodeissa `gpt-5.6-sol` / medium / network-off -profiilia. Tämä on project-local oletus, jonka provider-preflight validoi; platform ja contractit säilyvät provider- ja mallineutraaleina eikä fallbackia ole.

### Kolme canonical canvasia

Authoring-reitit ovat `/automation/graph`, `/automation/graph/nodes/:graphNodeId` ja `/automation/graph/nodes/:graphNodeId/jobs/:jobNodeId`. Run-reitit ovat `/run/graphs/:graphId` ja `/run/graph-nodes/:graphNodeId`. Vanhat authoring/run-reitit hylätään ilman aliasta.

Graph Engineering näyttää Graph Orchestratorin, valinnaisen Graph Repair Noden, GraphNode-planeetat ja kiinteät PASS/FAIL-connection pointit. Graph Node näyttää saman rakenteen vain valitun Graph Noden JobNode-planeetoille. Spoket kuvaavat candidate-jäsenyyttä, eivät child-to-child Edgejä. Job Node näyttää Work- ja Validation-planeetat, mintun validate-yhteyden, amber-retryn ja PASS/FAIL-terminalit.

Kaikki tasot käyttävät DESIGN-tokenien 24 px teknistä gridia, planet-artworkeja, reasoning glow'ta, amber-ID:itä, 1.5 px mint-spokeja, kirkkaita connection pointteja ja reduced-motion-tukea. Deterministinen monikehäinen layout, pan/zoom ja minimitekstikoko kattavat 1/5/40 GraphNodea sekä 1/17/64 JobNodea.

## Supersession-raja

Historiallisia ADR-tiedostoja ei kirjoiteta uudelleen.

| Aiempi päätös | Korvautuva osa | Säilyvä osa |
| --- | --- | --- |
| `adr-016` | Yhden Loopin Module v3 ja Loop-nimetty package/API korvautuvat yhden Graph Noden Module v4 -rajalla. | Inspect/plan/commit, strict trust, canonical hash, config-last materialisointi, provenance, no-live-dependency ja project/platform-raja. |
| `adr-018` | `ProjectLoop`, Graph/Loop-kaksinäkymä, cross-Loop Edge ja flow/repair-allowlist korvautuvat kolmella scopetulla canvasilla ja scoped orchestrator candidate -säännöillä. | Immutable snapshot, State, ihmisvaltuutus, provider-neutralisuus ja runtime-owned continuation. |
| `adr-020` | Erillinen `ProjectWorkflow`, persisted Pass/Fail Edget ja Loop-tason Graph-continuation korvautuvat JobNode-aggregaatilla ja orchestrator-dispatchilla. | Erilliset Work/Validation-roolit, 1:1-paritus, Work→Validation, bounded retry, State patch, technical failure -raja ja same-Validation repair return. |
| `adr-021` | Validationin sisään projisoiva Job-only Workflow-canvas korvautuu erillisellä kolmannen tason Work/Validation-canvasilla. | Avaruusteeman tokenit, planet-artworkit, glow, amber-ID:t, mint-yhteydet ja canonical projection -periaate. |
| `adr-022` | Exact named RunBook, startLoopId, transitions/repairEdges, Graph/Loop/scheduled Root Run ja strict-v13/v3/v9-versiot korvautuvat agenttiohjatulla strict candidate -reitityksellä, Graph/GraphNode Runeilla ja v14/v4/v10-rajalla. | Bounded State, immutable snapshot, worktree-eristys, external-write-ihmisvaltuutus, tracker/outbox-idempotenssi ja repair call/return. |

## Seuraukset

- Domain, API, UI, runtime ja module-raja vastaavat samaa kolmitasoista mentaalimallia ilman compatibility-matriisia.
- Tavallinen reititys ei ole enää targetiltaan deterministinen, mutta se on snapshotin strict candidate-joukon, roolisopimuksen, retry-rajan ja evidenssin rajaama.
- Luna pitää suuren reititysvolyymin projektidatan perusteella kustannusherkkänä; Sol on rajattu exception path, ei hiljainen fallback.
- Repairin suurempi kyvykkyys ei anna sille laajempia oikeuksia, uutta target-joukkoa tai ulkoisen kirjoituksen lupaa.
- Kolme canvasia vaativat vahvan scope-projektion ja deterministic layoutin, mutta poistavat foreign-level-solmut ja hybridin.
- Laaja strict cut tekee vanhasta runtime-kannasta tarkoituksella käyttökelvottoman ilman arkistointia.

## Hylätyt vaihtoehdot

### Hybridi exact RunBookin ja agenttirouterin välillä

Hylätty, koska kahden tavallisen reitityssemantiikan samanaikainen ylläpito tekisi snapshotista, editorista ja evidenssistä vaikeammin tulkittavan.

### Orchestrator ilman rajattua Repair Nodea

Hylätty, koska halpa reititin tarvitsee näkyvän ja valvotun exception pathin ennen ihmiseskalaatiota. Repairin scope ja yritysrajat estävät siitä muodostumasta toiseksi avoimeksi routeriksi.

### Work, Validation ja route-targetit vertaisohjeisiin

Hylätty, koska sibling-ID:iden tunteminen hajauttaisi routing truthin Node-instructioneihin. Vain saman tason orchestratorin instruction ja candidate-säännöt tuntevat targetit.

### Runtime-migraatio tai reittialias

Hylätty, koska tuote ei ole tuotannossa ja strict hard cut on yksinkertaisempi, testattavampi ja vähemmän painolastia jättävä ratkaisu.

## Evidenssi ja review trigger

Päätöksen trace on `goal-015` / `REQ-015`, `CON-011`, `RT-014`–`RT-015`, `QS-019`–`QS-020`, `TEST-019`–`TEST-020`, `EVID-019`–`EVID-020` ja initiative `three-level-graph-node-engineering`. Tekninen evidenssi ja ihmisvisual verdict kirjataan erikseen.

Päätös arvioidaan uudelleen ennen candidate-joukon muuttamista kesken Runin, standalone JobNode Runia, scheduletusta, GraphNode-määrärajan nostoa, repair-rajojen muuttamista, provider/model-fallbackia tai Repair Noden oikeuksien laajentamista.
