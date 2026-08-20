---
id: adr-020
title: Workflow Engineering ja erilliset Job- ja Validation-nodet
status: accepted
createdAt: '2026-08-20T00:00:00.000Z'
updatedAt: '2026-08-20T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - workflow-engineering
  - runtime
  - persistence
version: 1
---

# Workflow Engineering ja erilliset Job- ja Validation-nodet

## Konteksti

Strict-v11-baseline mallinsi valitun Loopin sisäisen työn composite `ProjectWorkLoopNode`na. Validation palautti `OK`-tuloksen tai valitsi `LOCAL_RETRY | ORCHESTRATOR_REPAIR` -moodin, ja UI piilotti ValidationNoden yhden Work-omisteisen canvas-artworkin sisään. Tämä teki rakenteesta, päätöksestä ja runtime-siirtymästä tarpeettomasti yhteen kytkettyjä.

Käyttäjä hyväksyi 2026-08-20 `goal-013`:n hard cut -päätöksen: valitun Loopin sisäinen malli ja näkymä korvataan Workflow Engineeringillä. Muutos koskee koordinoidusti domainia, schemaa, snapshotia, module packagea, task/outcome-sopimuksia, runtimea, SQLite-persistenssiä, API:a, UI:ta, repository-dataa ja dokumentaatiota.

## Päätös

### ProjectWorkflow

`ProjectLoop.workflow` sisältää `startJobNodeId`-viitteen sekä erilliset `jobNodes`, `validationNodes`, `passEdges` ja `failEdges` -kokoelmat.

- Jokainen JobNode viittaa täsmälleen yhteen omaan ValidationNodeen.
- ValidationNodea ei jaeta, jätetä orvoksi tai käytetä ilman JobNodea.
- Jokaisella ValidationNodella on täsmälleen yksi PassEdge ja yksi FailEdge.
- PassEdge kohdistuu JobNodeen tai kiinteään Workflow `PASS` -endpointiin.
- FailEdge kohdistuu aina kiinteään Workflow `FAIL` -endpointiin.
- Kaikki JobNodet ovat saavutettavia startista PassEdgeillä ja vähintään yksi PASS-endpoint on saavutettava.

### Runtime-siirtymät ja outcome

Jobin `completed` siirtyy kiinteästi paritettuun ValidationNodeen. Validationin provider-päätös on `PASS | FAIL`:

- `PASS` voi sisältää State patchin ja seuraa ValidationNoden PassEdgeä.
- `FAIL` ei sisällä State patchia. Se sisältää aina `feedback`, `expectedCorrection` ja target-ID:stä vapaan `requestedCapability | requestedOutcome` -eskaloinnin.

Ensimmäisen Job-ajon jälkeen sallitaan `maxRetries` paikallista retryä; oletus on kolme. Ensimmäinen, toinen ja kolmas Validation FAIL palaavat kiinteästi paritettuun JobNodeen. Neljännen Job-ajon FAIL seuraa FailEdgeä, muodostaa Repair Requestin ja siirtää kohdevalinnan Graph Engineeringin Orchestratorille.

Repairin valmistuminen palaa durable LIFO-framen osoittamaan samaan ValidationNodeen uusimmalla Root-owned Statella. Jobia ei ajeta uudelleen eikä retry-laskuria nollata. Seuraava FAIL eskaloituu heti. `needs_input` jatkaa samaa nodea. Tekniset Job/Validation `blocked | failed` -tilat terminaalisoivat Runin eivätkä seuraa FailEdgeä.

PassEdge → Job aloittaa uuden JobRunin retry-laskurilla nolla. PassEdge → Workflow PASS päättää Loop invocationin onnistuneena; vasta tämän jälkeen nykyinen Orchestrator-ohjattu Graph flow voi käynnistyä.

### Versiot ja persistenssi

Hard cut käyttää project config v12:ta, Root Execution Snapshot v5:tä, Loop Module package v2:ta, Task Envelope v5:tä, node outcome v5:tä, execution spec v7 / composition v6:ta ja SQLite schema v8:aa.

`work_loop_node_runs` korvataan `job_runs`-mallilla. Role `work` korvataan arvolla `job`, ja runtime-evidenssi käyttää Job- ja Workflow-identiteettejä. Immutable snapshot-, State revision-, transaction-, cancellation-, recovery-, repair-frame- ja continuation-invariantit säilyvät. Schema v7 -tietokantaa ei päivitetä automaattisesti: käynnistys epäonnistuu suljetusti ja kertoo täsmällisen archive/remediation-toimenpiteen.

### UI ja authoring

Kanoniset reitit ovat `/automation/loops?view=graph` ja `/automation/loops?view=workflow&id=<loop-id>`. `view=loop` hylätään ilman aliasta.

Workflow Engineering näyttää erilliset, itsenäisesti valittavat JobNode- ja ValidationNode-artworkit, kiinteän `validate`-yhteyden, mint/secondary PassEdget, Error-semanttiset FailEdget, dashed tertiary retry-polun ja tekstimuotoisen retry-rajan. PASS ja FAIL ovat kiinteitä endpointteja. Väriä täydennetään ikonilla ja tekstillä.

`Add Job` luo atomisesti Job/Validation-parin sekä PassEdge → PASS- ja FailEdge → FAIL -yhteydet. Pari poistetaan yhdessä, eikä start Jobia tai incoming PassEdgen kohdetta voi poistaa. Molemmilla nodeilla on oma editori. Layout on deterministinen, tukee syklejä, keyboard-käyttöä sekä desktop- ja narrow-viewportteja.

### Project/platform-raja

Platform toteuttaa vain geneeriset Workflow-, Node-, Edge-, State-, orchestration-, execution-, snapshot- ja persistence-primitivet. Projektikohtaiset Loopit, capabilityt, instructionit, skillit ja route policy säilyvät project-local-datana. Loop Module säilyy yhden Loopin siirrettävänä authoring/install-time artifactina.

## Supersession-raja

| Aiempi päätös | Korvautuva osa | Säilyvä osa |
| --- | --- | --- |
| `adr-015` | Composite `WorkLoopNode` / `WorkNode` -malli sekä Validationin `OK` ja mode-valinta. | Root-owned State ja revisionit, Orchestrator Repair Request, durable LIFO-frame, continuation, attempt/depth/transition-rajat, cancellation ja recovery. |
| `adr-018` | **Loop Engineering** -nimi, `view=loop`-reitti ja selected-Loopin composite sisäinen projektio. | Graph Engineering, `ProjectLoop` / `LoopNode`, project-global `LoopEdge`, capability/allowlist-dispatch, immutable snapshot ja Orchestrator-ohjattu Graph flow. |

ADR-020 ei muuta eikä supersedoi Loop Module -päätöstä ADR-016:ssa tai project/platform-vastuurajaa ADR-019:ssa. Historiallisia Goaleja, ADR:iä ja v11-evidenssiä ei kirjoiteta uudelleen.

## Seuraukset

- Domain ja UI vastaavat toisiaan ilman composite-nodea tai providerin valitsemaa control-flow-moodia.
- Eksplisiittiset Pass/Fail Edget tekevät onnistumis- ja eskalointirajat validoitaviksi ennen Runia.
- Hard cut poistaa compatibility-matriisin, mutta vaatii repository-datan kertamuunnoksen ja v7-tietokantojen eksplisiittisen arkistoinnin.
- Graph-, State-, Orchestrator-, Loop Module- ja project/platform-invariantit säilyvät.

## Hylätyt vaihtoehdot

### Pelkkä näkymän uudelleennimeäminen

Hylätty, koska composite domain, mode-pohjainen outcome ja piilotettu Validation eivät vastaisi käyttöliittymän lupaamaa rakennetta.

### Kolmas retry-edge-laji

Hylätty, koska retry on Job/Validation-parin kiinteä runtime-invariantti eikä authoroitava topologia.

### Compatibility-reader tai route-alias

Hylätty, koska pre-release hard cutin rinnakkainen v11/v12- ja loop/workflow-semanttiikka jättäisi pysyvää legacy-painolastia.

## Evidenssi ja review trigger

Toteutus arvioidaan `workflow-engineering`-initiativen `TEST-015` / `EVID-015` -ketjulla. Päätös arvioidaan uudelleen ennen jaettua ValidationNodea, authoroitavaa FAIL-targetia, automaattista tietokantamigraatiota tai sellaista retry/repair-muutosta, joka rikkoisi Root-owned State- tai continuation-invariantin.
