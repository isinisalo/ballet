---
id: arc42-section-05
title: Rakennusosanäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 24
tags:
  - arc42
  - building-blocks
arc42Section: 5
---

# 5. Rakennusosanäkymä

## Tarkoitus

Tämä osio kuvaa Balletin arkkitehtonisesti merkittävän staattisen jaon, vastuut, rajapinnat, laatuvaikutukset ja lähdekoodiankkurit. Aktiivinen strict-v19 implementation käyttää erikseen compiled global/local Reward-MDP-scopeja, erillistä acceptance-ledgeriä ja Graph Node Module v7 -rajaa.

## Tila

BB-001–BB-010 säilyvät yleisinä vastuualueina. BB-011/012 ovat historiallista scoped-policy/learning-jakoa ja BB-013 historiallinen single-policy-raja. BB-014 omistaa aktiivisen hierarchical Reward-MDP compiler/runtime/UI-rajan. ADR-025/027:n Action Node flow säilyy.

## Taso 1: Balletin rakennusosat

```mermaid
flowchart LR
  ui["BB-001 Frontend workspace"] --> api["BB-002 HTTP + application services"]
  api --> catalog["BB-003 Project catalog"]
  api --> planner["BB-004 Graph Run planner"]
  api --> modules["BB-009 Graph Node module boundary"]
  planner --> mdp["BB-014 Hierarchical Reward-MDP compiler"]
  mdp -->|"immutable global + local policies"| runtime["BB-005 Graph runtime"]
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
| BB-001 | Frontend operator workspace: capability-first cards, global 5×5 / local N×N Decision Modelit, protected Action flow ja factual Run-evidenssi. | Loopback HTTP JSON, shared DTO:t ja URL route/section state. | Ymmärrettävä, saavutettava ja projection/truth-rajan säilyttävä operointi. | `frontend/src/workspace/automation/`, `frontend/src/workspace/routing.ts`, `frontend/src/workspace/runs/` | REQ-001, REQ-007, REQ-018, REQ-021 |
| BB-002 | Local HTTP/application services validoivat pyynnöt ja orkestroivat käyttötapaukset. | Express router, service-portit ja shared schemas. | Fail-closed local boundary ja yksi mutaation omistaja. | `backend/http/`, `backend/services/`, `shared/api/` | REQ-001, REQ-006, REQ-015 |
| BB-003 | Project catalog lukee strict-v19 Graph/global policy/GraphNode/local policy/ActionNode/acceptance -konfiguraation ja resource closuren. | Repositoryt, base/readiness-skeemat, resource catalog ja workspace DTO:t. | Siirrettävä project truth; incomplete matriisi tallentuu mutta Run estyy. | `shared/domain/automation.ts`, `shared/domain/decisionModel*.ts`, `shared/api/workspace-schemas.ts`, `backend/project-config/` | REQ-002, REQ-003, REQ-021 |
| BB-004 | Graph Run planner luo Graph- tai GraphNode-snapshotin, compileeraa vaaditut policy-scopet ja worktreen. | Run service, GraphExecutionPlanner, RootRunStore ja BB-005/006/014. | Immutable execution, eristys ja turvallinen lifecycle ilman standalone Action Node Runia. | `backend/runs/GraphExecutionPlanner.ts`, `backend/runs/LocalRunService.ts`, `backend/runs/RootRunStore.ts` | REQ-004–REQ-006, REQ-015, REQ-021 |
| BB-005 | Runtime vuorottelee global/local compiled lookupit, Action Work→Validation→bounded retry -suorituksen, exact acceptance-portin ja typed branchit. | SQLite v15, strict outcome v9, acceptance/state/policy-storet ja provider-task-portti. | Atominen, outcome-aware, restartissa selitettävä hierarchical control flow. | `backend/runtime-db.ts`, `backend/runtime/RuntimeFlowCoordinator.ts`, `backend/storage/RuntimeSchema.ts` | REQ-004, REQ-006, REQ-021 |
| BB-006 | Provider execution ratkaisee exact compositionin, FIFO-kaistat ja adapterit. | ExecutionProfile, ExecutionSpec v11, Task Envelope v9 ja strict output schema. | Provider-neutralisuus, tavustabiili composition ja no-fallback; provider ei valitse MDP-actionia. | `backend/execution/`, `backend/integration/` | REQ-003, REQ-005, REQ-006, REQ-020 |
| BB-007 | Checkout lifecycle, Git branch/worktree ja macOS-jakelu. | CLI, Git, launchd ja release-artefaktit. | Active checkout -eristys ja ulkoisen kirjoituksen ihmisraja. | `backend/cli/`, `backend/execution/git/`, `scripts/`, `packaging/` | REQ-005, REQ-008 |
| BB-008 | Project-local arc42 Method resources ja validointi. | Markdown/JSON-polut, stable ID:t ja npm-validointi. | Jaettu intentio, traceability ja evidenssipohjainen muutos. | `.ballet/arc42/`, `.ballet/goals/`, `.ballet/adr/`, `.agents/skills/arc42/` | REQ-002, REQ-009, REQ-015 |
| BB-009 | Graph Node Module v7 inspect/plan/install/export/remove ja provenance; ActionNodet, intrinsic outcomes ja koko local policy mukana, peer-matriisi/acceptance/Repair pois. | Strict package/API, materialisointijono ja resource catalog. | Supply-chain-näkyvyys ja project/runtime/model-omistajuusrajan säilyminen. | `shared/domain/graphNodeModules.ts`, `shared/api/graph-node-module-schemas.ts`, `backend/graph-node-modules/` | REQ-002, REQ-010, REQ-021 |
| BB-010 | Tracker adapter ja transactional outbox. | argv-only process adapter, SQLite intent/linkit ja worktree-local stores. | Fail-closed external process boundary ja idempotentti reconciliation. | `backend/tracker/`, `backend/cli/TrackerCli.ts`, SQLite v15 tracker-taulut | REQ-006, REQ-015 |
| BB-011 | Historiallinen superseded scoped policy subsystem. | Ei active runtime -rajapintaa. | Säilyy vain audit trailina. | Historiallinen `goal-016/017` / `adr-026/028` evidence | REQ-016–REQ-017 |
| BB-012 | Historiallinen superseded offline learning/promotion -pinta. | Ei active runtime -rajapintaa. | Säilyy vain audit trailina. | Historiallinen `goal-019` / `adr-030` evidence | REQ-019 |
| BB-013 | Historiallinen single Graph Reward-MDP subsystem. | Ei aktiivista single-policy-rajapintaa. | Outcome-aware reward/authorization-periaatteet siirtyvät BB-014:ään. | Historiallinen `goal-020` / `adr-031` evidence | REQ-020 |
| BB-014 | Hierarchical Reward-MDP subsystem johtaa node-ID:t scopeista, canonicalisoi sparse branchit, compileeraa global/local Q/V-policyt, tarkistaa absorptionin ja portittaa local-terminalin acceptance-effectit. | Decision Model v4, Root Snapshot v12, policy decision/observation v5, BB-005:n facts ja BB-001:n 5×5/N×N read model. | Rajattu state-avaruus, deterministic branch, reward hacking -suoja, hard authorization ja selkeä control owner per scope. | `backend/policy/PolicyScope.ts`, `backend/policy/RewardMdpCompiler.ts`, `backend/runtime/RuntimeFlowCoordinator.ts`, `frontend/src/workspace/automation/DecisionModelWorkspace.tsx` | REQ-021 |

## Rajapinta- ja riippuvuussäännöt

- BB-001 käyttää backend-käyttötapauksia vain BB-002:n shared schema -rajapinnan kautta; frontend ei lue SQLitea tai Git-worktree-dataa suoraan.
- BB-003 toimittaa versionhallittua intentiota. BB-004 jäädyttää siitä immutable snapshotin; BB-005 ei lue käynnissä olevaan Runiin uutta project configia.
- BB-005 pyytää BB-006:lta roolitehtävän. BB-006 ei päätä GraphNode-actionia, retryä, escalate-outcomea tai terminaalia.
- BB-014 valitsee GraphNode- tai ActionNode-optionin scopekohtaisesti; provider ei valitse niitä. Out-of-contract outcome muuttaa canonical statea ja acceptance-ledgeriä nolla kertaa.
- BB-009 materialisoi package-datan project-local-resursseiksi config-last-transaktiolla. Runtime ei lue packagea eikä package sisällä peer-GraphNode-targetteja.
- BB-010 ei päätä Graph-control-flow'ta eikä issueita kopioida Stateen; pending reconciliation estää seuraavan vaikutuksen.
- BB-002–BB-007 toteuttavat vain geneerisiä primitivejä. Balletin viiden GraphNoden nimet ja arc42-/release-menettely pysyvät project-local-datassa.
- BB-014 saa state/action-ID:t vain snapshotatuista GraphNode- tai ActionNode-kokoelmista. Se ei tunne default-nodejen merkitystä, lue live project configia, kutsu provideria tai mutatoi probabilityjä/rewardia havaintojen perusteella.
- BB-005 omistaa atomisen dispatchin/terminalin. BB-014:n compiler toimii vain snapshot creationissa; runtime käyttää compiled row'ta ja hard admissible settiä.

## BB-001 whitebox: kolmitasoinen operator workspace

| Elementti | Vastuu | Omistajuus | Lähdeankkuri |
| --- | --- | --- | --- |
| Workspace route state | Jäsentää canonical Configure/Run-reitit, breadcrumbin ja browser back/forwardin. | URL omistaa aktiivisen Graph-, GraphNode- tai Action Node -scopen; inspector selection on ephemeral. | `frontend/src/workspace/routing.ts`, `WorkspaceRouteOutlet.tsx` |
| Graph Engineering | Projisoi Capability Graph -kortit ja global 5×5 Reward Decision Modelin omissa URL-osioissaan. | Sisältää vain GraphNode-rivit/sarakkeet; acceptance näkyy erillisenä gate-railina. | `AutomationView.tsx`, `CapabilityCards.tsx`, `DecisionModelWorkspace.tsx` |
| Graph Node | Projisoi valitun GraphNoden Action Node -kortit ja local N×N Decision Modelin. | Sisältää 0 peer-GraphNodea ja 0 toisen GraphNoden ActionNodea; terminalit eivät lisää rivejä. | `AutomationView.tsx`, `CapabilityCards.tsx`, `DecisionModelWorkspace.tsx` |
| Action Node | Projisoi Start/Work ID/Validation ID/Pass?/Retry?/Retry count/Continue/Escalate -industrial flow'n. | Vain Work/Validation ovat valittavia; Retry count on visuaalinen ghost, Continue jatkaa ordered sarjaa ja Escalate palauttaa typed Graph-outcomen. | `ActionFlowCanvas.tsx`, `actionFlowProjection.ts`, `EngineeringInspector.tsx` |
| Inspector/Sheet | Näyttää Work-, Validation- tai Action Node -asetukset ja instructionit; Graph-policy authoroidaan inline. | 22–24rem desktop inspector; narrow-viewportissa sama Action Node -sisältö Sheetissä. | `EngineeringInspector.tsx`, `EngineeringShell.tsx` |

Graph/Graph Node käyttävät responsive stable-order card gridia 1/5/40 GraphNode- ja 1/17/64 Action Node -fixtureille. Vain Action flow käyttää tummaa 24 px gridia, Work/Validation-artworkia, reduced motionia ja deterministic wide/narrow-flow-layoutia, jossa normal/retry/fail-yhteydet ja ghost/read-only-tilat ovat eksplisiittisiä. UI ei kirjoita runtime control statea.

## BB-004/005 whitebox: snapshot ja runtime

1. Planner hyväksyy Graph- tai GraphNode-targetin, validoi strict-v19-readinessin ja ratkaisee exact resource closuren.
2. Graph Run compileeraa global + reachable local policyt; GraphNode Run vain targetin local policyn Root Snapshot v12:een.
3. Runtime tekee global lookupin, dispatchaa GraphNoden, tekee local lookupin ja dispatchaa valitun ActionNoden.
4. Work `completed` siirtyy paired Validationiin; FAIL `retry` noudattaa `maxRetries`:a ennen typed outcomen palautusta local policylle.
5. Local state-branch päättää seuraavan local lookupin. Local terminal emittoi authoroidun GraphNode-outcomen; `escalate` ei ohita tätä branchia.
6. Terminal Validationin ledger-deltan on vastattava GraphNode-outcome-effectejä exactisti tai Root pysähtyy `needs_input`:iin ennen siirtymää.
7. GraphNode Run päättyy local terminaliin; Graph Run käsittelee emitted outcomen global branchilla. Molemmat scopet jakavat 256 päätöksen rajan.
8. SQLite v15 committoi scopekohtaiset decision/observation/acceptance/outcome/State/control-flow-faktat; vanhaa kantaa ei lueta tai migroida.

## BB-006 whitebox: composition ja provider

`ExecutionComposition` ratkaisee System → primary → vakaasti järjestetyt skillit → Task Envelope v9 → role/output schema -järjestyksen ja hashin. Sama snapshot/envelope tuottaa samat tavut. Profile, model, instruction tai skill ei saa fallbackia. Validation-output sisältää deklaroidun outcome-ID:n, matching PASS/FAIL:n, acceptance-evidenssin ja FAIL-dispositionin; BB-006 ei valitse Graph actionia.

## BB-014 whitebox: hierarchical Reward-MDP subsystem

| Osa | Vastuu | Input/output | Fail-closed-raja |
| --- | --- | --- | --- |
| Scope descriptor | Johtaa state/action/outcome-ID:t GraphNodeista tai yhden GraphNoden ActionNodeista ja laskee vain bound-obligation Graph-potentialin. | Snapshotattu Graph + scope → compiler input. | Free-floating ID, puuttuva initial tai local acceptance shaping → 0 Runia. |
| Decision model compiler | Tarkistaa sparse required cells, outcome-uniikkiuden, ppm-summat, branch targetit, guards/authorizationin ja absorptionin. | `ProjectScopedRewardDecisionStrategyV4` → `CompiledRewardPolicyV4` tai typed issue. | Nonterminal recurrent class, invalid numeric/reference tai iteration-bound failure → 0 Runia. |
| Decision State projector | Lukee scope-ID:n, runtime-/State revision-/authorization-faktat ja immutable ledgerin. | Canonical facts → `DecisionStateV4`. | Missing/unknown mapping → 0 policy decisioniä; transition prediction ei kirjoita statea. |
| Admissible action resolver | Leikkaa snapshot-, model-, hard guard-, authorization- ja lifecycle-rajat. | State + Capability Graph + guards → included/excluded actions. | Unauthorized action puuttuu `A(s)`:stä; persisted excluded Q = 0. |
| Reward solver | Laskee branchikohtaisen potential/rewardin ja deterministic discounted value iterationin stable orderissa kerran. | Finite model + per-state admissible actions → Q/V/policy/iterations/residual/hash. | Ei wall-clock-decision timeoutia, runtime re-solvea tai online mutationia. |
| Policy evidence projection | Näyttää scope/current state-, reward-, PPM/prior-, Q/V-, selected action- ja factual execution-faktat 5×5/N×N-matriisissa. | Persisted global/local decision/observation → read-only evidence. | Projektio ei ole control state; acceptance ei lisää policy-rivejä. |

## BB-009 whitebox: Graph Node Module v7

1. **Inspect:** rajoita koko, parsi UTF-8 JSON, validoi strict v7 mukaan lukien local policy, canonicalisoi ja laske SHA-256.
2. **Plan:** valitse deterministic namespace, vaadi explicit profile/instruction-mapping, listaa GraphNode/resource/provenance-muutokset ja hylkää peer-targetit.
3. **Install:** re-plannaa samasta inputista, materialisoi resource closure ja kirjoita project config viimeisenä.
4. **Export/remove:** vie yhden Graph Noden transitive closure tai poista vain omistettu sisältö; shared resources ja active Run -rajat säilyvät.

## Kanoniset lähteet

Shared contractit ja lähdekoodi omistavat suoritettavan käyttäytymisen. `adr-033` omistaa BB-014:n ja strict runtime-rajan, `adr-025`/`adr-027` Action-canvasprojektion, `DESIGN.md` visuaalisen järjestelmän ja tämä osio rakennusosajaon.

## Relevantit päätökset

`adr-001`–`adr-003`, `adr-005`–`adr-008`, `adr-011`–`adr-016`, `adr-025`, `adr-027`, `adr-029` säilyvin osin ja `adr-033`.

## Evidenssi

`TEST-027` / `EVID-027` kattavat aktiiviset domain-, snapshot-, compiler-, runtime-, persistence-, module- ja UI-rajat. BB-011–013:n vanha evidenssi säilyy historiallisissa initiativeissa. Tuotantokaltainen pilotti ja lopullinen ihmisvisual verdict ovat avoimia.

## Avoimet kysymykset

- Remote Graph Node Module registry ei kuulu BB-009:n nykyiseen rajaan.
- Ensimmäinen tuotantokaltainen pilotti mittaa Reward-MDP:n käytännön outcome/reward/completion-laatua; platform-raja ei muutu ilman uutta päätöstä.

## Seuraava katselmointiperuste

Katselmoi osio, kun vastuu, public interface, transaktion omistajuus, scope-raja tai source anchor siirtyy rakennusosien välillä.
