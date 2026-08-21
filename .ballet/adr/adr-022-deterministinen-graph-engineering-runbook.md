---
id: adr-022
title: Deterministinen Graph Engineering RunBook ja kaksistoreinen tk-sovitus
status: accepted
createdAt: '2026-08-20T00:00:00.000Z'
updatedAt: '2026-08-21T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - graph-engineering
  - runbook
  - tk
version: 2
---

# Deterministinen Graph Engineering RunBook ja kaksistoreinen tk-sovitus

## Konteksti

Strict-v12-baseline antoi Loop Orchestratorin valita tavallisen cross-Loop-flow'n snapshotin capability-candidateista. Se teki toteutetusta kontrollipolusta vaikeammin ennustettavan kuin käyttäjän antama RunBook, jossa jokaisella terminal Validationilla on nimetty tulos ja yksikäsitteinen kohde. Samalla ADR-019:n yksi arc42-vastuu per Loop johti 11 Loopin oletusgraafiin, vaikka käyttäjän hyväksymä toimintamalli on viisi selkeää toimitussilmukkaa ja DESIGNin sisällä 12 arc42-JobNodea.

Release- ja implementation-tehtävien pitää säilyä koneellisesti claimattavina, riippuvuuksineen ja restart-safeina ilman, että niitä kopioidaan Stateen tai Story/Release Mapiin. Käyttäjä hyväksyi tämän päätösrajan ja strict hard cutin eksplisiittisesti 2026-08-20.

## Päätös

### Graph ja RunBook

Project configuration v13:n `graph` sisältää `startLoopId`:n sekä erilliset `transitions`- ja `repairEdges`-kokoelmat. Tavallinen transition on yksikäsitteinen avaimella `(source, decision, outcome)` ja target on olemassa oleva Loop tai `DONE`. Kaikkien 1–40 Loopin pitää olla saavutettavia startista ja ainakin yhden polun johtaa `DONE`:en.

`ProjectLoopOrchestrator.mode` on `runbook`. Terminal Validation valitsee vain Task Envelope v6:ssa annetusta enumista `transitionOutcome`-arvon; Orchestrator ratkaisee kohteen immutable Root Execution Snapshot v6:sta ilman flow-targetin provider-päättelyä. Väli-Validation ei saa antaa Graph-outcomea. Terminal FAIL saa antaa joko nimetyn RunBook-outcomen tai repair-pyynnön, ei molempia.

`GraphOrchestrationStateV1` persistoi graph/start/current Loop -viitteet, viimeisimmän transitionin, transition countin, mahdollisen `DONE`:n ja ulkoisen seurannan viitteet. Tavallinen Graph Run käynnistyy graphista; eksplisiittinen Loop Run ja scheduled JobNode ovat erillisiä Root Runeja eivätkä jatka Graphiin. Transition limit on 256.

### Repair säilyy erillisenä call/returnina

Repair-edge ei ole RunBook-transition. Kun niitä on, valinnainen agenttipohjainen repair-router saa valita vain snapshotin allowlistasta. Repair pushataan durable frameen ja palaa LIFO-periaatteella samaan Validation Nodeen. Kun repair-edgejä ei ole, Orchestratorilla ei ole agenttikoostumusta.

### Oletusprojektin viisi Loopia

Repositoryn project-local-oletusgraafi on `design → plan → build → deploy → verify`, ja sillä on käyttäjän määrittelemät 18 named transitionia. DESIGN sisältää 12 järjestettyä arc42-Job/Validation-paria. PLAN omistaa Story/Release Mapin valinnan ja issueiden materialisoinnin, BUILD yhden ready-issuen per invocation, DEPLOY ihmisvaltuutetun ulkoisen kirjoituksen ja VERIFY toteutuksen conformance-arvion. Nimet ja menettely eivät kuulu platform-koodiin.

### `tk` ja transactional outbox

Project-local tracker-konfiguraatio käyttää kahta worktree-sisäistä storea: `.tickets/orchestration` ja `.tickets/work`. Runtime omistaa orchestration-storen Root Run epicit ja Loop invocation choret. Work-store omistaa release epicit ja `task | feature | bug | chore` -toteutusissuen.

SQLite v9 on runtime-ohjauksen totuus. Runtime kirjoittaa tracker-intentin outboxiin ennen `tk`-prosessia, käyttää yksilöllisiä external-ref-avaimia ja linkittää sovitetun ticketin vasta onnistuneen komennon jälkeen. Pending tai epäonnistunut operaatio estää Runin etenemisen ja siirtää sen `waiting_for_input`-tilaan; Resume/startup reconciliation sovittaa pending-operaatiot ennen jatkoa.

`tk` ajetaan argv-taulukkona ilman shelliä vain Run-worktreessä, timeout- ja output-rajoilla. Preflight tekee eristetyssä tilapäishakemistossa capability-proben ja validoi JSONL/Markdownin, external-refit, parentit, riippuvuudet ja syklit. Agenttien sisäinen `ballet tracker` -CLI on rajattu work-storeen; orchestration-storea ei voi muokata sen kautta.

### Version cut

Koordinoitu hard cut on project config 13, Root Snapshot 6, Task Envelope 6, outcome 6, prompt composition 7, ExecutionSpec 8, runtime DB 9 ja Loop Module Package 3. Vanhat lukijat, dual-write, automaattinen konversio ja silent defaultit poistetaan. Vanha tietokanta jää koskemattomaksi ja virhe kertoo täsmällisen archive/remediation-polun.

V3-module erottaa `recommendedTransitions`- ja `recommendedRepairs`-reitit. Oikeus `externalWrites: "requires-human-authorization"` on DEPLOY-moduulin eksplisiittinen metadata eikä itsessään lupa kirjoittaa ulkoiseen järjestelmään.

## Supersession-raja

Tämä ADR ei muuta historiallisten ADR-tiedostojen tekstiä.

| Aiempi päätös | Korvautuva osa | Säilyvä osa |
| --- | --- | --- |
| `adr-018` | Tavallisen flow-targetin agentti-/capability-dispatch, zero-flow completion ja flow-candidate ambiguity korvautuvat exact named RunBook-transitionilla ja eksplisiittisellä `DONE`:lla. | Graph/Workflow-erottelu, immutable snapshot, project-global topology, repair allowlist/call-return, ihmisvaltuutus ja platform/project-raja. |
| `adr-019` | Repositoryn oletusprojektin yksi arc42-canonical-output per Loop -granulariteetti korvautuu viidellä toimitus-Loopilla ja DESIGNin 12 erillisellä JobNodella. | Yksi selkeä Loop-tarkoitus/done-condition, project-local menettely, geneerinen module/platform-raja ja peer-targetien kuuluminen Graphiin. |
| `adr-020` | Strict-v12/v2-versionumerot ja Workflow PASS/FAILin jälkeinen flow-Orchestrator-kytkentä korvautuvat v13/v3 named transition -rajalla. | Erillinen Job/Validation-domain, Pass/Fail Edget, retry, State, repair-return ja teknisen failure-tilan rajat. |

ADR-021:n Workflow-canvasin suojattu projektio säilyy kokonaan.

## Seuraukset

- Tavallisen Graph-flow'n target voidaan todentaa ilman provider-kutsua ja toistaa täsmälleen samasta snapshotista.
- Validation-outputin sallittu outcome-joukko riippuu current Loopin terminal-transitioneista ja on osa exact compositionia.
- Runtime-, tracker-, module-, config-, API- ja UI-sopimusten version cut on laaja, mutta aktiiviseen koodiin ei jää compatibility-matriisia.
- `tk` on Graph Runin paikallinen prerequisite ja erillinen vikaantumispinta; outbox/reconciliation tekee epäonnistumisesta näkyvän ja fail-closedin.
- Story/Release Map säilyy kevyenä suunnittelutotuutena, implementointitehtävät vain trackerissa ja bounded State vain viitteinä.
- Graph Engineering yksinkertaistuu, mutta Workflow Engineeringin visuaalinen sopimus ei muutu.

## Hylätyt vaihtoehdot

### LLM valitsee tavallisen flow-targetin

Hylätty, koska RunBookissa transitionin kohde on project truth eikä arviointitehtävä.

### Transitions ja repairs samassa edge-kokoelmassa

Hylätty, koska tavallinen continuation ja LIFO-returnilla varustettu capability repair ovat eri runtime-semanticsia.

### Ticketit Stateen tai release-karttaan

Hylätty, koska se loisi rinnakkaisen tracker-totuuden ja kasvattaisi snapshot/Statea pitkäikäisellä dokumentti- tai issue-sisällöllä.

### Sisäänrakennettu issue tracker tai frontend-editori

Hylätty tässä rajassa, koska project käyttää pinnattua `tk`:ta rajatun adapterin läpi eikä Ballet-platformin tarvitse omistaa yleistä issue-domainia.

## Evidenssi ja review trigger

Päätöksen acceptance-ketjut ovat `goal-014` / `REQ-014`, `QS-016`–`QS-018`, `TEST-016`–`TEST-018`, `EVID-016`–`EVID-018` ja initiative `graph-engineering-runbook`. Paikalliset schema/runtime/hermetic/final gatet ja browser-QA läpäisivät 2026-08-21; projektin omistajan visual verdict ja oikean pinnatun `tk`:n live-smoke pysyvät pending-tilassa.

Päätös arvioidaan uudelleen ennen dynamic transition creationia kesken Runin, cross-worktree tracker-storea, remote trackeria, 40 Loopin rajan nostoa, transition limitin muuttamista tai repair-routerin poistamista call/return-polulta.
