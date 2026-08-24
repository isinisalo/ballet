---
id: adr-033
title: Graph ja GraphNode käyttävät erillisiä node-omisteisia Reward-MDP-scopeja
status: accepted
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arkkitehtuuripaatos
  - reward-mdp
  - hierarkia
  - ui
---

# Graph ja GraphNode käyttävät erillisiä node-omisteisia Reward-MDP-scopeja

## Konteksti

ADR-031:n yksi Graph-policy yhdisti acceptance-ledger-kombinaatiot 62 decision stateksi ja suoritti GraphNoden ActionNodet array-järjestyksessä. ADR-032 visualisoi tämän suuren state-avaruuden, mutta ei poistanut käyttäjän havaitsemaa käsitteellistä ongelmaa: Graph Engineeringin viisi tilaa eivät näyttäneet 5×5-matriisilta eikä PLANin kaksi ActionNodea 2×2-matriisilta. Noden lisääminen uhkasi kasvattaa policy- ja ledger-käsitteitä toisiinsa sidottuna.

## Päätösajurit

- `goal-021`, `REQ-021` ja `QS-027`.
- Selkeä Graph 5×5 / GraphNode N×N -mental model ilman 62 tilan tai karteesisen ledger-avaruuden taulukkoa.
- Yksi deterministic control owner per scope ja exact global/local call-return.
- Acceptance-progressin reward-hacking-suoja sekä immutable evidenssiportti.
- 40×40 global- ja 64×64 local-UI ilman page overflow'ta.

## Päätös

### Node-omisteiset scope-rakenteet

`ProjectScopedRewardDecisionStrategyV4` omistaa eksplisiittisen `initialStateId`:n, scopekohtaisen rewardin, sparse `(stateId, actionId)` -solut, guards-ehdot, typed outcome -branchit ja deterministic solverin. Graph-scope johtaa sekä state- että action-ID:t GraphNodeista. Jokainen GraphNode johtaa ne omista ActionNodeistaan. Vapaata state- tai capability-action-katalogia ei ole.

Branch target on joko saman scopen state tai `success | failure | blocked` -terminal. Terminal ei lisää matriisiriviä. Paikallinen terminal emittoi täsmälleen yhden GraphNode-outcomen globaalille policylle. Solun outcome-ID:t ovat uniikkeja ja probabilityjen summa on 1 000 000 ppm. Runtime ei arvo successor-tilaa: havaittu typed outcome valitsee authoroidun branchin deterministisesti.

### Acceptance erotetaan policysta

Acceptance-ledger kuuluu Graphille. GraphNode voi sitoutua yhteen obligaation ID:hen, mutta uusi node ei luo obligaatiota automaattisesti. Vain eksplisiittisesti sidottujen obligaatioiden järjestys ja painot muodostavat globaalin state-potentialin. Sitomaton GraphNode, ActionNoden pilkkominen tai duplicate verification antaa progress-rewardia nolla.

GraphNode-outcome voi määrittää acceptance-effectit. Local terminalin viimeisen Validation-outcomen verify/invalidate-deltan ja evidenssiviitteiden on vastattava effectejä exactisti. Ristiriita siirtää Runin `needs_input`-tilaan ennen ledger- tai global policy state -muutosta.

### Compiler, snapshot ja runtime

Graph Run compileeraa globaalin ja kaikki reachable local-policyt kerran immutable Root Snapshot v12:een. GraphNode Run compileeraa vain kohteen local-policyn. Jokainen scope käy determinismi-, guard-, absorption- ja authorization-tarkistuksen.

Runtime-polku on:

```text
global decision → GraphNode → local decision → ActionNode
→ Work → Validation → bounded retry → local branch
→ local terminal / GraphNode outcome → global branch
```

`Continue` palauttaa typed outcomen local policylle. `Escalate` saavuttaa globaalin policyn vain authoroidun local-terminal-branchin kautta. Automaattinen seuraava array-alkio poistuu. Global- ja local-policy-päätökset jakavat yhden 256 siirtymän Root Run -rajan; ActionNoden `maxRetries` säilyy erillisenä.

### Data, CRUD ja moduulit

Default authoroi vain “nykyinen + aiemmat” -solut: Graph 15/25, PLAN 3/4 ja DESIGN 78/144. Tulevaan vaiheeseen ei hypätä ilman authoroitua solua. Uusi node lisää rivin ja sarakkeen mutta jättää puuttuvat solut näkyviksi ja Runin blocked-tilaan. Rename päivittää initial/state/action/target-viitteet atomisesti; delete estyy, kun viitteitä jää.

Graph Node Module v7 kantaa koko local policyn, rewardin ja initial staten. Peer-GraphNode-matriisi sekä acceptance-binding/effectit pysyvät project-globalina.

### Käyttöliittymä

Graph ja GraphNode näyttävät saman semanttisen CSS-grid-Q(s,a)-matriisin. Sticky headerit, panelin sisäinen scroll ja yli 20 rivin virtualisointi kattavat 40×40/64×64-fixturet. Current state, compiled policy choice, unavailable cell ja inspector selection erotetaan tekstillä, ikonilla ja tilalla. Positiivinen reward on Secondary/vihreä `+`, cost Error/punertava `−` ja prior-estimate Tertiary/amber `≈`. Exact micros/ppm säilyvät accessible detailissä.

Graph-matriisin GraphNode-otsikko zoomaa local Decision Modeliin. Solu avaa kompaktin outcome/probability/guard/target-inspectorin. Acceptance näkyy erillisenä gate-railina, ei policy-state-riveinä.

### Strict cut

Hard cut on Project Config v19, Decision Model v4, Graph Node Module v7, Root Snapshot v12, policy decision/observation v5 ja SQLite v15. Task Envelope/Outcome v9, composition v10 ja ExecutionSpec v11 säilyvät. Vanhoja v18/v3/v6/v11/v14-readereita, migraatioita, aliaksia tai dual-writeä ei ole.

## Seuraukset

- Default Graph on kirjaimellisesti 5×5 ja PLAN 2×2; acceptance-ledgerin koko ei riipu nodejen määrästä.
- Control flow sisältää kaksi selvästi rajattua policy-lookupia, mutta yhden immutable snapshotin ja yhteisen siirtymärajan.
- Puuttuva solu on näkyvä authoring/readiness-ongelma eikä implisiittinen array-flow.
- Local completion bonus syntyy kerran terminalissa; local reward ei sisällä Graph-progressia.
- Runtime-evidenssi erottaa global/local decisionit ja observationit scope-kentällä.

## Hylätyt vaihtoehdot

- **62 ledger-statea yhdessä matriisissa:** hylätty, koska acceptance-evidenssi ja node-control ovat eri käsitteitä.
- **Kaikkien 62 tilan karteesinen local/global-taulukko:** hylätty skaalautumattomana ja vaikeasti authoroitavana.
- **ActionNodejen array-järjestys local policyn sijasta:** hylätty, koska backtrack, invalid-design-terminal ja typed outcome eivät olisi eksplisiittisiä.
- **Satunnaisotos ppm-jakaumasta runtime-ohjaukseen:** hylätty, koska havaittu outcome omistaa branchin ja ajon pitää olla toistettava.
- **Acceptance-obligaation automaattinen luonti node-addissa:** hylätty reward hacking -riskinä.

## Supersession

ADR-033 supersedoi ADR-031:n single-policy-, ledger-state- ja ordered ActionNode -osat sekä ADR-032:n 62-state landscape/pulse/horizon -projektion. ADR-031:n outcome-aware reward, hard authorization, deterministic absorption, immutable snapshot ja bounded Action retry säilyvät. ADR-032:n ihmisyksiköt, exact-detail, reward/cost/estimate-semanttiset värit sekä no-heavy-form/table-periaate säilyvät.

## Evidenssi ja review trigger

Trace on `goal-021` / `REQ-021`, `QS-027`, `adr-033` / `CON-014`, `BB-014`, `RT-025`, `TEST-027`, `EVID-027` ja initiative `hierarchical-reward-mdp`.

Uusi ADR vaaditaan, jos state/action-ID:t irrotetaan nodeista, acceptance tuodaan local rewardiin, runtime alkaa arpoa branchin, local/global scopeja yhdistetään tai matriisin control-semanttiikka muuttuu.
