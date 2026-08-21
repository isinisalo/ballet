---
id: goal-014
title: Viiden Loopin deterministinen Graph Engineering RunBook
status: accepted
createdAt: '2026-08-20T00:00:00.000Z'
updatedAt: '2026-08-20T00:00:00.000Z'
tags:
  - tavoite
  - graph-engineering
  - runbook
  - issue-tracker
version: 1
---

# Viiden Loopin deterministinen Graph Engineering RunBook

## Tavoite

Ballet-projektin oletusgraafi toteuttaa yhden jatkuvan ohjelmistotoimituksen viidellä project-local Loopilla: `design`, `plan`, `build`, `deploy` ja `verify`. Tavallinen Graph Run etenee versionhallittujen nimettyjen `(decision, outcome)`-siirtymien kautta eikä anna mallin valita seuraavaa Loopia.

Platform tarjoaa vain geneeriset Graph-, Loop-, Workflow-, transition-, repair-, snapshot-, State-, tracker- ja runtime-primitivet. Yksittäinen projekti voi määrittää 1–40 Loopia; viiden Loopin nimet, arc42-menettely, release-kartta, deploy-portti ja `tk`-työtapa ovat Ballet-repositoryn project-local-dataa.

## Tarkoitus

- DESIGN ylläpitää kaikkia 12 kanonista arc42-osiota erillisinä JobNodeina.
- PLAN valitsee seuraavan releasen docs-as-code Story/Release Mapista ja materialisoi toteutustyön `tk`:hon.
- BUILD käsittelee täsmälleen yhden ready-issuen yhtä Loop invocationia kohti.
- DEPLOY valmistelee täsmällisen suunnitelman ja odottaa erillistä ihmisvaltuutusta ennen ulkoista kirjoitusta.
- VERIFY vertaa deployattua versiota designiin, acceptanceen ja ticket-evidenssiin ja valitsee vain sallitun `more_work`- tai `complete`-tuloksen.

## Deterministinen reititys

Terminal Validation valitsee strict output -skeeman sallitusta enumista `transitionOutcome`-arvon. Runtime ratkaisee täsmälleen yhden transitionin immutable Root Run -snapshotista avaimella `(source, decision, outcome)`. `DONE` on Graph Runin terminal-tulos, ei Loop. Tavalliset RunBook-siirtymät eivät käytä LLM-routeria; optional repair-router saa toimia vain erillisten repair-edgejen allowlistalla ja palauttaa samaan Validationiin.

Graph Run alkaa `graph.startLoopId`:stä. Eksplisiittinen Loop Run ja scheduled JobNode ovat erillisiä Root Runeja eivätkä jatka Graph-transitioneihin. Transition count on rajattu 256:een.

## Issue tracker ja State

`tk` on project Runin pakollinen koneelle asennettava issue tracker. Runtime hallitsee `.tickets/orchestration`-storea ja agenttien rajattu tracker-CLI `.tickets/work`-storea. Yksilölliset external-refit, SQLite v9:n outbox/linkit ja startup reconciliation estävät duplikaatit sekä etenemisen ennen onnistunutta sovitusta.

`GraphOrchestrationStateV1` omistaa Root Runin Graph-control-faktat. Projectin bounded `GraphEngineeringStateV1` omistaa vain release/map-, aktiivinen work-issue-, target environment-, deploy authorization/evidence- ja verification-viitteet. Dokumentteja, ticket-runkoja, diffejä tai lokeja ei kopioida Stateen.

## Hard cut

Koordinoitu compatibility-readeriton raja on project config v13, Root Execution Snapshot v6, Task Envelope ja node outcome v6, prompt composition v7, execution spec v8, runtime database v9 ja Loop Module Package v3. Vanhat kannat ja repository-data jätetään koskemattomiksi tai arkistoidaan täsmällisellä remediation-ohjeella; niitä ei tulkita hiljaisesti uudeksi malliksi.

## Visuaalinen raja

Graph Engineering käyttää pelkistettyä vasemmalta oikealle kerrostettua kortti- ja transition-esitystä. Workflow Engineeringin tumma avaruusteema, planeettamaiset Job-artworkit, koot, hehkut, amber-ID-labelit, mintunväriset yhteydet ja kirkkaat connection pointit säilyvät muuttumattomina.

## Rajaukset

- Frontendiin ei lisätä issue-editoria.
- Platformiin ei kovakoodata release-, deploy-, arc42- tai viiden Loopin tunnisteita.
- Release, deploy, rollback, merge, push tai muu ulkoinen kirjoitus ei saa valtuutusta tästä Goalista; jokainen toiminto tarvitsee täsmällisen ihmisvaltuutuksen.
- Vanhasta 11 Loopin oletusgraafista, continuous-learning-oletusloopista tai kymmenestä arc42-moduulista ei säilytetä aktiivista compatibility-dataa.

## Todentaminen

Tavoite on toteutunut, kun `QS-016`–`QS-018` / `TEST-016`–`TEST-018` osoittavat strict version cutit, kaikki 18 oletustransitionia, snapshot-determinismin ja 256-transition rajan, Graph/isolated/scheduled/repair-semanticsin, 1/5/40-Loop-layoutit, Workflow-visuaalisen regression sekä `tk`-sovituksen fail-closed-idempotenssin. Live `tk`-smoke raportoidaan erikseen eikä hermetic fake-CLI:n läpäisyä väitetä live-asennuksen evidenssiksi.
