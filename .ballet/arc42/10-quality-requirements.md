---
id: arc42-section-10
title: Laatuvaatimukset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 24
tags:
  - arc42
  - quality
  - scenarios
arc42Section: 10
---

# 10. Laatuvaatimukset

## Tarkoitus ja tila

Tämä osio omistaa aktiiviset, mitattavat hyväksymisskenaariot. QS-014–QS-023, QS-025 ja QS-026 säilyvät historiallisina trace-ketjuina. QS-024 säilyttää capability-first/protected Action flow -vaatimuksen. QS-027 on strict-v19 hierarchical Reward-MDP:n priority-1-raja.

## Laatupuu

```mermaid
flowchart TD
  quality["Balletin laatu"] --> safety["Turvallisuus"]
  quality --> integrity["Determinismi ja eheys"]
  quality --> recovery["Palautettavuus"]
  quality --> usability["Käytettävyys ja ylläpidettävyys"]
  safety --> q1["QS-001 checkout-local"]
  safety --> q4["QS-004 worktree/network"]
  safety --> q7["QS-007 external write"]
  integrity --> q2["QS-002 resource closure"]
  integrity --> q11["QS-011 composition"]
  integrity --> q26["QS-026 Reward-MDP"]
  integrity --> q27["QS-027 hierarchical Reward-MDP"]
  recovery --> q12["QS-012 restart/cancel"]
  usability --> q5["QS-005 architecture truth"]
  usability --> q9["QS-009 Module v7"]
  usability --> q24["QS-024 authoring"]
```

## Laatuskenaariot

<!-- quality-scenarios:start -->
| ID | Source | Stimulus | Environment | Affected artifact | Expected response | Measurable response criterion | Priority | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QS-001 | goal-001, goal-007 | Operaattori käynnistää Balletin commitoidusta checkoutista. | Tuettu macOS-host ja paikallinen selain. | BB-001, BB-002, DEP-001 | Palvele vain checkout-local-komentokeskusta. | API bindaa vain loopbackiin; toisella checkoutilla on eri identity/state; lifecycle/API-smoke läpäisee. | 1 | EVID-001 | verified |
| QS-002 | goal-002, goal-003 | Root Run pyydetään muuttuneilla tai virheellisillä project-resursseilla. | Preflight ennen provider-tehtävää. | BB-003, BB-004, CON-003 | Snapshottaa yksi deterministinen validi resource closure tai failaa suljetusti. | Invalidi/duplikaatti/puuttuva profile, instruction tai skill tuottaa exact issuen ja 0 provider-taskia; sama input tuottaa samat hashit. | 1 | EVID-002 | verified |
| QS-003 | goal-004, goal-006, goal-021 | Validation palauttaa FAIL-dispositionin retry tai escalate. | Active Action Node, immutable snapshot ja SQLite v15. | BB-004, BB-005, RT-025 | Noudata bounded retryä tai palauta typed semantic outcome local policylle. | Work-yritykset ≤ `maxRetries + 1`; loppunut retry dispatchaa 0 ylimääräistä Workia; outcome käsitellään yhdessä local branchissa; erillisiä Repair-tauluja/rooleja 0. | 1 | EVID-003, EVID-027 | implementation verified |
| QS-004 | goal-005 | Provider-Node suoritetaan. | Root Run -worktree. | BB-004, BB-006, DEP-002, CON-001 | Pidä kirjoitukset worktreessä ja noudata profilen network-rajaa. | Permission/worktree-testit läpäisevät; active checkout -kirjoituksia 0; network ei laajene fallbackilla. | 1 | EVID-004 | verified |
| QS-005 | goal-009 | Arkkitehtuuri- tai method-artefakti muuttuu. | Repository-validointi ennen handoffia. | BB-003, BB-008, CON-006 | Säilytä yksi ratkaistava source of truth vakailla ID:illä. | `npm run validate:arc42` raportoi 0 puuttuvaa dokumenttia, duplicate ID:tä, broken linkkiä, unresolved tracea tai resource referenceä. | 1 | EVID-005, EVID-026 | implementation verified |
| QS-006 | goal-009 | Initiative saavuttaa evaluation-vaiheen. | Rajatun toteutuksen jälkeen. | BB-008, CON-006 | Traceaa in-scope priority-1-kriteerit testiin/evidenssiin ja nimeä puute. | REVIEW kattaa 100 % in-scope priority-1-QS:istä; ajamatonta pilottia ei merkitä läpäistyksi. | 1 | EVID-006 | review |
| QS-007 | goal-005, goal-008, goal-009 | Merge, push, release, deploy tai rollback pyydetään. | Local runtime ilman tai täsmällisellä valtuutuksella. | BB-006, BB-007, CON-001, CON-013 | Pysähdy ennen hyväksymätöntä ulkoista toimintoa. | Ennen kirjattua valtuutusta external write -komentoja 0; Project State ei voi antaa lupaa; yritetyt toimet nimetään evidenssissä. | 1 | EVID-007, EVID-026 | policy verified; live effect not exercised |
| QS-008 | goal-009 | Menetelmästä löytyy mahdollinen parannus. | Evidenssipohjainen evaluation. | BB-008, CON-006 | Säilytä vain materiaalinen finding ja vie semanttinen muutos päätösrajaan. | Findingillä on lähde, vaikutus, QS/RISK/ADR/BB-viite ja mittari; ei findingiä → 0 semanttista churnia. | 2 | EVID-008 | pending operational evidence |
| QS-009 | goal-010, goal-021 | Graph Node Module importoidaan, asennetaan, viedään tai poistetaan. | Strict v7 package, API ja release fixture. | BB-001–BB-003, BB-009, RT-024, CON-007 | Validoi/hashaa local policy mukaan lukien, näytä plan ja materialisoi config-last. | Kaikki 14 v7 package/inspect/install/export/remove/hash-roundtripit läpäisevät; stale/conflict/active-operaatio kirjoittaa 0 config-muutosta; peer-target/acceptance-binding/effect pakettiin = 0. | 1 | EVID-009, EVID-027 | implementation verified; release smoke pending final gate |
| QS-010 | goal-011, goal-018 | Operaattori navigoi Graph-, GraphNode- ja Action Node -authoringissa. | Canonical URL, desktop/narrow, keyboard. | BB-001, CON-005 | Säilytä yksi hierarkia, scope ja authoritative post-save state. | Route/CRUD/back-forward/keyboard-testit läpäisevät; foreign-scope-elementtejä ja route-aliaksia 0. | 1 | EVID-010, EVID-024 | implementation verified |
| QS-011 | goal-003 | Sama Root Snapshot ja Task Envelope koostetaan toistuvasti; required resource rikotaan. | Codex/Copilot adapter boundary. | BB-003, BB-004, BB-006, CON-003 | Tuota validille inputille tavutasolla sama payload ja estä invalidi composition. | Prompt bytes, composition hash, resource order ja output schema ovat identtiset; invalidi composition jonottaa 0 taskia; fallbackeja 0. | 1 | EVID-011 | verified |
| QS-012 | goal-006 | Palvelu restarttaa queued/running-työn aikana tai myöhäinen payload saapuu cancellationin jälkeen. | Checkout-local SQLite v15. | BB-004–BB-006, RT-022, CON-002 | Säilytä queued, merkitse running interruptediksi ilman replayta ja estä duplicate/post-cancel-vaikutus. | Queued säilyy; running on kerran interrupted; State/ledger/policy/outcome/event-duplicateja 0; post-cancel state effect 0. | 1 | EVID-012, EVID-027 | verified hermetically |
| QS-013 | goal-007 | Operaattori tarkastaa aktiivista tai finalisoitua Runia. | Immutable snapshot ja canonical read store. | BB-001, BB-002, BB-005, CON-005 | Näytä position, Action Node, attempt, revision, acceptance, reward, Q/V ja finalization vain canonical datasta. | DTO/view-testit läpäisevät; provider-proosasta johdettuja state-kenttiä, prosentteja, ETA:a tai elapsed-arvoja 0. | 1 | EVID-013, EVID-026 | implementation verified |
| QS-014 | goal-012 | Historiallinen Graph/Loop authoring -vaihe. | Superseded v11. | historical | Säilytä audit trail, älä käytä active acceptanceen. | Active v18 sisältää Loop/Orchestrator-polkuja 0. | historical | EVID-014 | superseded |
| QS-015 | goal-013 | Historiallinen Workflow/Edge-vaihe. | Superseded v12. | historical | Säilytä Work→Validation-intentio vain Action Node -sopimuksessa. | Active v18 sisältää Workflow/PassEdge/FailEdge-polkuja 0. | historical | EVID-015 | superseded |
| QS-016 | goal-014 | Historiallinen exact RunBook -vaihe. | Superseded v13. | historical | Säilytä project-local default flow ja tracker-invariantit. | Active control owner on ADR-031. | historical | EVID-016 | superseded |
| QS-017 | goal-014 | Historiallinen Graph/Workflow visual -vaihe. | Superseded v13. | historical | Säilytä vain jäljelle jäävät design-tokenit ja evidenssi. | Active UI noudattaa QS-024:ää. | historical | EVID-017 | superseded |
| QS-018 | goal-006, goal-014 | Tracker kohtaa timeoutin, malformed outputin, partial effectin tai restartin. | SQLite v15 ja hermetic fake CLI. | BB-005, BB-010, RT-022 | Estä eteneminen ennen reconciliationia ja säilytä stable external-ref. | Failed preflight task = 0; partial/restart ticket per external-ref = 1; pending outboxin aikana seuraavia dispatch-vaikutuksia 0. | 1 | EVID-018 | hermetic verified; pinned live smoke pending |
| QS-019 | goal-015 | Historiallinen scoped routing/Repair -vaihe. | Superseded v14. | historical | Säilytä vain Graph/GraphNode/Action Node -scope-intentio. | Active scoped orchestrator-, Repair- ja routing persistence -polkuja 0. | historical | EVID-019 | superseded |
| QS-020 | goal-015 säilyvä osa | Operaattori käyttää Graph-, GraphNode- ja Action Node -tasoja 1/5/40 GraphNode- ja 1/17/64 Action Node -fixtureillä. | 1440×900, 390×844, keyboard, reduced motion ja Run-lukko. | BB-001, CON-005 | Säilytä capability cards ja protected deterministic Action flow. | Kolme authoring-routea ja kaksi Run-routea; Action flow näyttää Start/Work/Validation/Pass?/Retry?/Retry count/Continue/Escalate; vain Work/Validation ovat painikkeita; overlap/page overflow/clipped core action = 0. | 1 | EVID-020, EVID-024, EVID-026 | automated/browser verified; human project-owner verdict pending |
| QS-021 | goal-016 | Historiallinen Graph-only SSP-vaihe. | Superseded v15. | historical | Säilytä finite-policy-intentio ADR-031:ssä. | Active `ssp_v1`/agent fallback -polkuja 0. | historical | EVID-021 | superseded |
| QS-022 | goal-017 | Historiallinen scoped SSP feature-state -vaihe. | Superseded v16/v17. | historical | Säilytä audit trail; ADR-033:n node-ID-local policy ei jatka tätä compatibility-polulla. | Active `ssp_v2`/feature-state/agent-fallback-polkuja 0. | historical | EVID-022 | superseded |
| QS-023 | goal-017 | Historiallinen scoped model-miss/cost-vaihe. | Superseded v17. | historical | Säilytä actual state- ja immutable observation -periaatteet. | Observation v4 mutatoi modelia 0 kertaa. | historical | EVID-023 | superseded |
| QS-024 | goal-007, goal-018 säilyvä osa, goal-021 | Operaattori authoroi capabilityja, outcomeja ja scopekohtaisia Decision Modeleita tai käyttää Action Node CRUDia. | Canonical URL sections, desktop/narrow, keyboard/focus, long IDs ja scale-fixturet. | BB-001, BB-002, CON-005, CON-014 | Näytä Capability Graph, global 5×5, Action Nodes, local N×N ja protected Action flow; erota compiled policy factual executionista. | CRUD/reitit läpäisevät; foreign-scope-nodeja/Repair-UI:ta 0; card/matrix page overflow/clipped action = 0; Run näyttää exact scope/state/acceptance/PPM/reward/Q/V/policy/effect-faktat. | 1 | EVID-024, EVID-027 | automated/browser verified; human verdict pending |
| QS-025 | goal-019 | Historiallinen calibration/shadow/promotion-vaihe. | Superseded v17. | historical | Säilytä observation vain audit trailina. | Active dataset registry-, candidate-, shadow-, activation- ja rollback-polkuja 0. | historical | EVID-025 | superseded |
| QS-026 | goal-020 | Historiallinen single Graph Reward-MDP -vaihe. | Superseded strict v18. | historical | Säilytä outcome-aware reward, hard authorization ja deterministic compiler ADR-033:ssa. | Active single-policy/ledger-state/array-order-sopimuksia 0. | historical | EVID-026 | superseded |
| QS-027 | goal-021 | Node lisätään/renametaan/poistetaan tai global/local typed outcome havaitaan; kohtaamme retry/exhaustionin, backtrackin, terminal-escalationin, acceptance-mismatchin, restartin, authorizationin ja suuren matriisin. | Strict v19/v4/v7/v12/v9/v10/v11/v5/v15; Graph 1/5/40, local 1/17/64; 1440×900 ja 390×844. | BB-001–BB-006, BB-009, BB-014, RT-022–RT-025, CON-014 | Johda state/action-ID:t nodeista, compileeraa required scopet kerran, valitse observed branch deterministisesti, portita terminal ledger exactisti ja näytä 5×5/N×N ilman raskasta form/table-pintaa. | Default Graph 15/25, PLAN 3/4, DESIGN 78/144; +10 GraphNodea = 15×15 ja ledger-size ennallaan; probability = 1 000 000 ppm/cell; duplicate outcome = 0 hyväksyttyä; unbound node ja Action-split progress-reward = 0; local completion bonus kerran; happy/backtrack/retry/exhaustion/escalate/mismatch/restart/out-of-contract testit läpäisevät; combined policy decisions ≤ 256; rename atominen ja dangling delete = 0; Module v7 hash-roundtrip; semantic CSS-grid, keyboard/focus, reduced motion, page overflow/clipped core action/console error = 0; lint warning = 0. | 1 | EVID-027 | technical acceptance passed; human/pilot evidence pending |
<!-- quality-scenarios:end -->

## Priorisoinnin tulkinta

- Prioriteetti 1 estää acceptance-väitteen, jos kriteeriä ei ole osoitettu tai rajoitusta hyväksytty eksplisiittisesti.
- Historiallinen rivi säilyttää trace-ID:n; se ei ole aktiivinen release-portti.
- Testin läpäisy todentaa nimetyn ympäristön, ei tuotantokaltaista pilottia tai ulkoista vaikutusta.

## Kanoniset lähteet ja evidenssi

Goalit omistavat quality intention. Tämä osio omistaa mitattavat skenaariot ja [TRACEABILITY](TRACEABILITY.md) niiden päätös/rakenne/test/evidence-ketjut. Aktiivisen cutin päätös on `adr-033`; `adr-025`/`adr-027` omistavat protected Action flow'n. `EVID-027` päivitetään vain ajetuista porteista, ja tuotantokaltainen pilotti säilyy erillisenä pending-evidenssinä.

## Avoimet kysymykset

- Tuotantokaltaisen pilotin budgetti, stop-ehdot ja operatiiviset hyväksymismitat vaativat project ownerin päätöksen ennen ajoa.
- QS-012:n hermetic fault injection täydentyy myöhemmin operatiivisella restart-evidenssillä.

## Seuraava katselmointiperuste

Katselmoi osio, kun Goal muuttuu, skenaariota ei voi mitata tai evaluation osoittaa, ettei kriteeri erota onnistumista epäonnistumisesta.
