---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 13
tags:
  - arc42
  - building-blocks
arc42Section: 5
---

# 5. Rakennusosanäkymä

## Tarkoitus

Tämä osio kuvaa Balletin arkkitehtonisesti merkittävän staattisen jaon, vastuut, rajapinnat, laatuvaikutukset ja lähdekoodiankkurit. Strict-v14-baseline käyttää yhtä sisäkkäistä Graph/GraphNode/JobNode-domainia, scoped orchestrator/repair-runtimea ja Graph Node Module v4 -rajaa.

## Tila

BB-001–BB-010 säilyvät vastuualueina. ADR-023 muuttaa BB-001/003/004/005/009:n sopimukset: kolme canonical canvasia korvaavat Graph/Workflow-kaksinäkymän, Graph/GraphNode Runeissa kaikki tasojen väliset päätökset ovat agenttiohjattuja ja schedule poistuu. Strict cut on config v14, snapshot v7, envelope/outcome v7, composition v8, ExecutionSpec v9, SQLite v10 ja Graph Node Module v4.

## Taso 1: Balletin rakennusosat

```mermaid
flowchart LR
  ui["BB-001 Frontend workspace"] --> api["BB-002 HTTP + application services"]
  api --> catalog["BB-003 Project catalog"]
  api --> planner["BB-004 Graph Run planner"]
  api --> modules["BB-009 Graph Node module boundary"]
  planner --> runtime["BB-005 Graph routing runtime"]
  planner --> tracker["BB-010 tracker adapter + outbox"]
  runtime --> tracker
  runtime --> execution["BB-006 Provider execution"]
  planner --> lifecycle["BB-007 Checkout lifecycle"]
  catalog --> method["BB-008 arc42 Method resources"]
  modules --> catalog
  runtime --> catalog
```

| ID | Rakennusosa ja vastuu | Rajapinnat | Laatuvaikutus | Lähdekoodiankkurit | REQ |
| --- | --- | --- | --- | --- | --- |
| BB-001 | Frontend operator workspace: Configure/Run, kolme scopettua Engineering-canvasia, inspector/Sheet ja canonical Run-näkymät. | Loopback HTTP JSON, shared DTO:t ja URL-route state. | Ymmärrettävä, saavutettava ja foreign-scope-dataa näyttämätön operointi. | `frontend/src/workspace/automation/`, `frontend/src/workspace/routing.ts`, `frontend/src/workspace/runs/` | REQ-001, REQ-007, REQ-015 |
| BB-002 | Local HTTP/application services validoivat pyynnöt ja orkestroivat käyttötapaukset. | Express router, service-portit ja shared schemas. | Fail-closed local boundary ja yksi mutaation omistaja. | `backend/http/`, `backend/services/`, `shared/api/` | REQ-001, REQ-006, REQ-015 |
| BB-003 | Project catalog lukee strict-v14 Graph/GraphNode/JobNode-konfiguraation ja resource closuren. | Repositoryt, resource catalog ja workspace DTO:t. | Siirrettävä, katselmoitava ja deterministisesti ratkaistu project truth. | `shared/domain/automation.ts`, `shared/domain/automationReachability.ts`, `backend/project-config/` | REQ-002, REQ-003, REQ-015 |
| BB-004 | Graph Run planner luo Graph- tai GraphNode-snapshotin, worktreen ja ensimmäisen scoped dispatchin. | Run service, GraphExecutionPlanner, RootRunStore ja BB-005/006. | Immutable execution, eristys ja turvallinen lifecycle ilman standalone JobRunia. | `backend/runs/GraphExecutionPlanner.ts`, `backend/runs/LocalRunService.ts`, `backend/runs/RootRunStore.ts` | REQ-004–REQ-006, REQ-015 |
| BB-005 | Graph routing runtime validoi role-outcomet, Staten, retryt, scoped orchestrator-päätökset, repair-framet ja terminaalit. | SQLite v10, strict role outcomes ja provider-task-portti. | Atominen, rajattu ja restartissa selitettävä control flow. | `backend/runtime-db.ts`, `backend/runtime/GraphRoutingEngine.ts`, `backend/storage/RuntimeSchema.ts` | REQ-004, REQ-006, REQ-015 |
| BB-006 | Provider execution ratkaisee exact compositionin, policyt, FIFO-kaistat ja adapterit. | ExecutionProfile, ExecutionSpec v9, Task Envelope v7 ja strict output schema. | Provider-neutralisuus, tavustabiili composition ja no-fallback. | `backend/execution/`, `backend/integration/` | REQ-003, REQ-005, REQ-006, REQ-015 |
| BB-007 | Checkout lifecycle, Git branch/worktree ja macOS-jakelu. | CLI, Git, launchd ja release-artefaktit. | Active checkout -eristys ja ulkoisen kirjoituksen ihmisraja. | `backend/cli/`, `backend/execution/git/`, `scripts/`, `packaging/` | REQ-005, REQ-008 |
| BB-008 | Project-local arc42 Method resources ja validointi. | Markdown/JSON-polut, stable ID:t ja npm-validointi. | Jaettu intentio, traceability ja evidenssipohjainen muutos. | `.ballet/arc42/`, `.ballet/goals/`, `.ballet/adr/`, `.agents/skills/arc42/` | REQ-002, REQ-009, REQ-015 |
| BB-009 | Graph Node Module v4 inspect/plan/install/export/remove ja provenance. | Strict package/API, materialisointijono ja resource catalog. | Supply-chain-näkyvyys ja project/runtime-rajan säilyminen. | `shared/domain/graphNodeModules.ts`, `shared/api/graph-node-module-schemas.ts`, `backend/graph-node-modules/` | REQ-002, REQ-010, REQ-015 |
| BB-010 | Tracker adapter ja transactional outbox. | argv-only process adapter, SQLite intent/linkit ja worktree-local stores. | Fail-closed external process boundary ja idempotentti reconciliation. | `backend/tracker/`, `backend/cli/TrackerCli.ts`, SQLite v10 tracker-taulut | REQ-006, REQ-015 |

## Rajapinta- ja riippuvuussäännöt

- BB-001 käyttää backend-käyttötapauksia vain BB-002:n shared schema -rajapinnan kautta; frontend ei lue SQLitea tai Git-worktree-dataa suoraan.
- BB-003 toimittaa versionhallittua intentiota. BB-004 jäädyttää siitä immutable snapshotin; BB-005 ei lue käynnissä olevaan Runiin uutta project configia.
- BB-005 pyytää BB-006:lta roolitehtävän. BB-006 ei päätä dispatch-targetia, repairia, retryä tai terminaalia.
- Orchestrator saa vain BB-005:n muodostaman snapshotatun enum-joukon. Providerin out-of-snapshot-target muuttaa canonical statea nolla kertaa.
- BB-009 materialisoi package-datan project-local-resursseiksi config-last-transaktiolla. Runtime ei lue packagea eikä package sisällä peer-GraphNode-targetteja.
- BB-010 ei päätä Graph-control-flow'ta eikä issueita kopioida Stateen; pending reconciliation estää seuraavan vaikutuksen.
- BB-002–BB-007 toteuttavat vain geneerisiä primitivejä. Balletin viiden GraphNoden nimet ja arc42-/release-menettely pysyvät project-local-datassa.

## BB-001 whitebox: kolmitasoinen operator workspace

| Elementti | Vastuu | Omistajuus | Lähdeankkuri |
| --- | --- | --- | --- |
| Workspace route state | Jäsentää canonical Configure/Run-reitit, breadcrumbin ja browser back/forwardin. | URL omistaa aktiivisen Graph-, GraphNode- tai JobNode-scopen; inspector selection on ephemeral. | `frontend/src/workspace/routing.ts`, `WorkspaceRouteOutlet.tsx` |
| Graph Engineering | Projisoi globaalin Luna Orchestratorin, optional Sol Repair Noden, GraphNode-planeetat, candidate-spoket ja PASS/FAIL-terminalit. | Sisältää 0 Job/Work/Validation-nodea. | `AutomationView.tsx`, `EngineeringShell.tsx`, `SpaceEngineeringCanvas.tsx` |
| Graph Node | Projisoi vain valitun Graph Noden orchestratorin, repairin ja JobNode-planeetat. | Sisältää 0 peer-GraphNodea ja 0 toisen Graph Noden Jobia. | `EngineeringShell.tsx`, `SpaceEngineeringCanvas.tsx` |
| Job Node | Projisoi Work- ja Validation-planeetat, fixed validate/retry-yhteydet ja terminalit. | Work/Validation ovat valittavia; Job-asetukset avataan otsakkeen komennosta. | `SpaceEngineeringCanvas.tsx`, `EngineeringInspector.tsx` |
| Inspector/Sheet | Näyttää orchestrator-, repair-, Work-, Validation- tai Job-asetukset ja instructionit. | 22–24rem desktop inspector; narrow-viewportissa sama sisältö Sheetissä. | `EngineeringInspector.tsx`, `EngineeringShell.tsx` |

Canvas käyttää tummaa 24 px gridia, project theme -artworkeja, reasoning glow'ta, amber-ID:itä, 1.5 px mint-spokeja, kirkkaita connection pointteja ja reduced-motionia. Deterministinen monikehäinen layout, pan/zoom ja minimitekstikoko kattavat 1/5/40 GraphNodea sekä 1/17/64 JobNodea. Spoke kuvaa authoroidun candidate-säännön membershipiä, ei child-to-child Edgeä.

## BB-004/005 whitebox: snapshot ja runtime

1. Planner hyväksyy vain Graph- tai GraphNode-targetin, validoi strict-v14-scopen ja ratkaisee exact resource closuren sekä explicit profile/instruction-mappingit.
2. Root Snapshot v7 jäädyttää project headin, Staten, kaikki sallitut target-enumit, compositions, rightsit, resurssit ja limitit.
3. Runtime kutsuu Graph Orchestratoria Graph Runin alussa ja jokaisen GraphNode-tuloksen jälkeen; Graph Node Orchestratoria GraphNode-ajon alussa ja jokaisen JobNode-tuloksen jälkeen.
4. Work `completed` siirtyy aina paired Validationiin. Validation `FAIL` palaa Workiin retryrajan sisällä; rajan jälkeen orchestrator valitsee strict repair/escalation-candidateista.
5. Invalidi orchestrator-target voidaan uusia enintään kolme kertaa. Saman tason Repair Node voi patchata validoitua Statea tai Run-worktreen artefakteja, dispatchata sallittuun repair-candidateen tai eskaloida.
6. Durable frame palauttaa repairista samaan Validationiin uusimmalla Statella, Work rerun = 0 ja retry reset = 0. Depth/attempt ovat enintään 3 ja transition count enintään 256.
7. GraphNode Runin normaali flow päättyy paikalliseen terminaliin. Ylempi Graph Orchestrator on käytettävissä vain repair-eskalaatioon.
8. SQLite v10 committoi request/decision/frame/outcome/State/control-flow-faktat transaktiorajojen mukaisesti. V9-kanta failaa suljetusti eikä sitä muuteta.

## BB-006 whitebox: composition ja provider

`ExecutionComposition` ratkaisee System → primary → vakaasti järjestetyt skillit → Task Envelope v7 → role/output schema -järjestyksen ja hashin. Sama snapshot/envelope tuottaa samat tavut. Profile, model, instruction tai skill ei saa fallbackia. Ballet-projectin orchestrator mapping käyttää Luna/medium/network-off-profiilia ja repair mapping Sol/medium/network-off-profiilia; BB-006 käsittelee niitä kuten mitä tahansa explicit `ExecutionProfile`-dataa.

## BB-009 whitebox: Graph Node Module v4

1. **Inspect:** rajoita koko, parsi UTF-8 JSON, validoi strict v4, canonicalisoi ja laske SHA-256.
2. **Plan:** valitse deterministic namespace, vaadi explicit profile/instruction-mapping, listaa GraphNode/resource/provenance-muutokset ja hylkää peer-targetit.
3. **Install:** re-plannaa samasta inputista, materialisoi resource closure ja kirjoita project config viimeisenä.
4. **Export/remove:** vie yhden Graph Noden transitive closure tai poista vain omistettu sisältö; shared resources ja active Run -rajat säilyvät.

## Kanoniset lähteet

Shared contractit ja lähdekoodi omistavat suoritettavan käyttäytymisen. `adr-023` omistaa uuden vastuurajan, `DESIGN.md` visuaalisen järjestelmän ja tämä osio rakennusosajaon.

## Relevantit päätökset

`adr-001`–`adr-003`, `adr-005`–`adr-008`, `adr-011`–`adr-016` ja `adr-023` sekä niiden ADR-023:ssa säilytetyt invariantit.

## Evidenssi

`TEST-019` kattaa domain-, snapshot-, runtime-, persistence- ja module-rajat. `TEST-020` kattaa BB-001:n reitit, scope-projektiot, a11y:n ja layoutin. Conformance-evidenssi indeksoidaan `EVID-019`/`EVID-020`:een.

## Avoimet kysymykset

- Remote Graph Node Module registry ei kuulu BB-009:n nykyiseen rajaan.
- Ensimmäinen tuotantokaltainen pilotti mittaa Luna-routerin ja Sol-repairin käytännön laatua; platform-raja ei muutu ilman uutta päätöstä.

## Seuraava katselmointiperuste

Katselmoi osio, kun vastuu, public interface, transaktion omistajuus, scope-raja tai source anchor siirtyy rakennusosien välillä.
