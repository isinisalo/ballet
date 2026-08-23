---
id: arc42-section-12
title: Sanasto
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 16
tags:
  - arc42
  - glossary
arc42Section: 12
---

# 12. Sanasto

## Tarkoitus

Tämä osio määrittää project-, authoring-, runtime-, tracker-, provider-, persistence-, module- ja UI-termit, joiden yhteinen täsmällinen merkitys vaikuttaa arkkitehtuuriin, toteutukseen tai handoffiin. Lähdekoodin nimet säilyvät englanniksi, vaikka selitys on suomeksi.

## Tila

Active implementation on strict-v17 `Graph → GraphNode → JobNode → Work/Validation`, explicit scoped `agent_v1 | ssp_v2`, Graph Node Module v5, Root Snapshot v10, policy observation v3 ja SQLite v13. ADR-028–ADR-030 ovat accepted; strict-v13/Loop/Workflow/RunBook-termit säilyvät historiallisena audit trailina.

## Active strict-v17 ja policy-termit

| Termi | Status | Määritelmä |
| --- | --- | --- |
| Graph | accepted | Project-global user-authored automation boundary, joka omistaa yhteisen Staten, Graph Orchestratorin/Repair Noden ja 1–40 GraphNodea. |
| GraphNode | accepted | User-defined, stable-ID:llä viitattu capability ja runtime invocation boundary. Default-projektin nodejen nimet eivät ole platform primitivejä. SMDP-mallissa yksi GraphNode on yksi Option/action. |
| JobNode | accepted | GraphNoden aggregate child, joka omistaa täsmälleen yhden WorkNoden, yhden ValidationNoden ja bounded retryn. |
| Capability Model / Capability Graph | review implementation | Intrinsic outcome -katalogi, scoped actions ja hard guardit yhdessä repository-backed Graph/GraphNode/JobNode-rakenteen kanssa: mitä järjestelmä voi tehdä ja mitkä actionit voidaan aloittaa. Ei probability-, cost- tai execution history -lähde. |
| Decision Model | accepted | Snapshotattava finite state/action/transition/cost/terminal/solver-konfiguraatio, josta SSP-policy ratkaistaan. Project truth, ei runtime observationista automaattisesti muuttuva malli. |
| Decision State | accepted | Decision epochissa canonical factseista johdettu bounded finite feature vector + state ID/hash. Ei sama asia kuin arbitrary project State eikä itsenäisesti patchattava workflow state. |
| Decision epoch | review implementation | Graph-scope ennen GraphNode-optionia ja GraphNode-scope ennen JobNode-actionia sekä aina actionin canonical terminaalin jälkeen; runtime projisoi Staten ja valitsee/terminoi policyn perusteella. |
| Admissible action set `A(s)` | accepted | Snapshot-, candidate-, model-, permission-, human authorization- ja lifecycle-rajojen leikkaus. Poissuljettu action ei saa Q-arvoa. |
| Option | accepted/refined | GraphNode temporaalisesti laajennettuna actionina: initiation set tulee hard admissibilitystä, internal policy local `ssp_v2`- tai pilotin ajan agent-strategiasta ja termination intrinsic semantic outcome + PASS/FAIL -rajasta. |
| SSP goal | accepted | Explicit absorbing `success` Decision State, jonka arvo on 0. `failure` ja `blocked` ovat explicit non-goal terminaleja, eivät halpoja actioneita. |
| Proper policy | accepted | Policy, joka saavuttaa success-terminalin probabilityllä 1 jokaisesta sallitusta nonterminal lähtötilasta. Failure/blocked tai suljettu non-goal recurrent class tekee policysta improperin. |
| Policy Projection | implemented | Current Decision Statesta ja configured/snapshotted mallista johdettu branch/cumulative probability rollout, jonka rajat ovat enintään 20 decision epochia ja 100 projection-nodea. `Most Likely Rollout` valitsee täydellisen bounded terminal/cutoff-trajectoryn suurimmalla cumulative probabilityllä, ei greedy-haaralla. Ei Current Plan tai dispatch authority. |
| Execution Graph | accepted/refined | Persistoidut vain toteutuneet scoped observationit `(state_before, action, expected distribution, outcome, PASS/FAIL, actual projected state, model match)` model/snapshot refs -viitteineen. Ei muuta Decision Modelia automaattisesti. |
| Model miss | review implementation | Observationin `outcome_miss`, `state_miss` tai `outside_support`; `match` tarkoittaa outcome- ja state-ennusteen osumaa. Luokka ei muuta prioreita, vaan seuraava policy ratkaistaan actual statesta. |
| `agent_v1` / `ssp_v2` | review implementation | Eksplisiittiset Graph- ja GraphNode-strategiat. Ensimmäinen käyttää scoped LLM candidate routingia, toinen Bellman SSP-policya; niiden välillä ei ole fallbackia. |
| Capability-first authoring | review implementation | Graphin Capability Graph / Decision Model ja GraphNoden Jobs / Local Decision Model & Repair -korttiosiot. Upper-level appearance/canvas ei ole domain dataa; Job industrial flow säilyy. |

## Historiallinen strict-v13 project ja authoring

| Termi | Määritelmä |
| --- | --- |
| Project truth | Versionhallittu, ihmis- ja agenttikatselmoitava tieto checkoutissa: Goalit, ADR:t, arc42, `.ballet/project.json`, instructions, skills, release map, source ja design. Eri asia kuin machine-local runtime state ja ticket-store. |
| Strict-v13 | Nykyinen project config hard cut: 1–40 `ProjectLoop`ia ja `ProjectGraphV13`, jossa tavalliset named transitionit ja repair-edget ovat eri kokoelmissa. V12-lukijaa tai automaattista muunnosta ei ole. |
| Project Loop | `.ballet/project.json`:ssa materialisoitu Loop, joka sisältää identityn, capabilityt, bounded Staten ja yhden `ProjectWorkflow`-rakenteen. |
| Loop | Nimetty authoring- ja runtime-raja. Oletusprojektissa Loopit ovat DESIGN, PLAN, BUILD, DEPLOY ja VERIFY; platform ei tunne näitä nimiä. |
| ProjectWorkflow | Valitun Loopin sisäinen rakenne: start Job, erilliset Job/Validation-kokoelmat sekä persisted Pass/Fail Edget. |
| JobNode | Rooli, joka tuottaa rajatun työn, omistaa täsmälleen yhden ValidationNoden ja siirtyy valmistuttuaan kiinteästi siihen. |
| ValidationNode | Rooli, joka arvioi paired Jobin tuloksen ja palauttaa PASS/FAIL-päätöksen, terminalissa sallitun `transitionOutcome`-arvon tai rajatun repair-pyynnön. |
| Terminal Validation | Workflow'n viimeinen Validation, joka voi valita Graph Runissa yhden snapshotin sallitun named outcomen. Väli-Validation ei voi antaa graph outcomea. |
| PassEdge | ValidationNoden onnistumisyhteys seuraavaan JobNodeen tai Workflow PASS -endpointiin. |
| FailEdge | ValidationNoden eskalointiyhteys Workflow FAIL -endpointiin; retryrajan sisäinen paluu ei ole Edge. |
| Fixed Workflow transition | Job → paired Validation ja paikallinen Validation FAIL → paired Job retryrajan sisällä; ei authoroitava Edge-laji. |
| ProjectGraphTransition | Tavallinen RunBook-reitti, jonka avain on yksilöllinen `(source, decision, outcome)` ja target on Loop tai DONE. |
| ProjectRepairEdge | Tavallisista transitioneista erillinen capability-allowlist Validation → repair Loop -kutsulle. |
| Named outcome | Snake_case-arvo, jonka terminal Validation valitsee snapshotatusta enumista; enintään 64 merkkiä. |
| DONE | Graph Runin eksplisiittinen terminal-tulos. Se ei ole Loop tai canvasin authoroitava kortti. |
| Story/Release Map | `.ballet/releases/STORY-RELEASE-MAP.md`:n kevyt docs-as-code-järjestys stable release/story ID:ille, statuksille, design/acceptance-viitteille ja target environmentille. Toteutustaskit eivät asu kartassa. |
| ExecutionProfile | Project-local provider/model/reasoning/permission-kokoonpano, joka on erotettu Node-roolin primary instruction- ja skill-valinnoista. |
| Resource closure | Kaikki target Loopin/Node-roolin deterministisesti tarvitsemat profiili-, instruction-, skill- ja schema-resurssit. |

## Historiallinen strict-v13 runtime ja control flow

| Termi | Määritelmä |
| --- | --- |
| RunBook | Immutable Root Snapshotista ajettava deterministinen state machine. Validation valitsee decision/outcomen, runtime ratkaisee exact transitionin ilman kohteen LLM-päättelyä. |
| Loop Orchestrator | Geneerinen runtime-komponentti, jonka `runbook`-mode soveltaa named transitioneja ja joka käyttää valinnaista agenttipohjaista routeria vain repair-edgeille. |
| Root Run | Yksi eristetty suoritus ja State-omistaja. Kind on `graph` tai `loop`. |
| Graph Root Run | Käyttää `graph.id`:tä, aloittaa `startLoopId`:stä, seuraa named transitioneja ja päättyy vain DONEen tai pysäytykseen. |
| Loop Root Run | Ajaa yhden eksplisiittisesti valitun Loopin. Manuaalinen ja scheduled JobNode -ajo eivät jatka Graph-transitioneihin. |
| Loop invocation | Yhden Loopin suoritus Root Runissa; orchestration-storeen sovitetaan siitä child `chore`. |
| Immutable Root Snapshot | Runin alussa jäädytetty graph, reachable Loopit, resource closure ja versionoidut sopimukset. Checkoutin myöhempi muutos ei muuta käynnissä olevan Runin reititystä. |
| GraphOrchestrationStateV1 | Runtime-tyyppi graph/start/current Loop -viitteille, viimeiselle transitionille, transition countille, DONElle ja ulkoisen seurannan viitteille. |
| GraphEngineeringStateV1 | Project-local bounded State release/map-, active issue-, target environment-, deploy authorization/evidence- ja verification-viitteille. Ei sama asia kuin GraphOrchestrationState tai `tk`-issue. |
| State patch | Schema-validi bounded State -muutosehdotus. Validation FAIL ei patchaa Statea. |
| Outcome | Roolikohtaisen strict output -skeeman läpäissyt tulos; providerin vapaa teksti ei ole outcome. |
| `transitionOutcome` | Terminal ValidationCompletedOutcomeV6:n named outcome, jonka on kuuluttava snapshotin sallittuun enumiin. |
| Local retry | Runtime-invariantti, joka palauttaa Validation FAILin paired Jobiin retryrajan sisällä. |
| Repair Request | Immutable Validation-finding ja capability. Terminal FAIL sisältää joko transitionOutcomen tai repair-pyynnön, ei molempia. |
| Repair frame | Persistoitu call-frame, joka säilyttää caller Loopin ja Validationin LIFO-paluuta varten. |
| Transition limit | Graph Runin enintään 256 toteutunutta named transitionia; seuraava yritys estetään fail-closedisti. |
| `needs_input` | Pysähtymistila, jossa puuttuva WHAT/WHY, prioriteetti, merkittävä päätös, deploy-valtuutus tai yksikäsitteinen repair-target vaatii ihmistä. |
| Reconciliation | Startup/resume-prosessi, joka sovittaa runtime- ja tracker-intentit ilman replayta tai duplikaattivaikutusta. |
| Finalization | Root Runin terminal-tilan, canonical control-faktan ja worktree-evidenssin commitointi; ei automaattinen merge, push tai deploy. |

## `tk` ja persistence

| Termi | Määritelmä |
| --- | --- |
| `tk` | Koneelle asennettava issue tracker -prerequisite. Ballet tukee pinnatun revision käyttäytymistä eikä vendoroi tai automaattisesti asenna komentoa. |
| Orchestration store | Worktreen `.tickets/orchestration`: runtime-only-store, jossa Root Run on `epic` ja Loop invocation child `chore`. |
| Work store | Worktreen `.tickets/work`: release `epic` ja `task|feature|bug|chore`-toteutusissuet, joita PLAN/BUILD/VERIFY käsittelevät rajatulla CLI:llä. |
| External ref | Idempotenssiavain kuten `ballet-root:<id>`, `ballet-loop-run:<id>` tai `ballet-release:<id>`. Yhdellä storella arvo on yksilöllinen. |
| Tracker outbox | SQLite v9:n intent-taulu. Runtime kirjoittaa intentin ensin ja sallii etenemisen vasta onnistuneen `tk`-sovituksen ja linkityksen jälkeen. |
| Tracker link | SQLite-taulun runtime-entiteetin, store-roolin, external-refin ja sovitetun ticket ID:n suhde. |
| Tracker adapter | Rajattu argv-pohjainen prosessiportti, joka toimii vain konfiguroidussa worktreessä timeout- ja output-rajoilla ilman shelliä. |
| `ballet tracker` | Agenttien sisäinen work-store-CLI: upsert, query, ready/claim, start, note, close ja reopen. Orchestration-store ei ole agenttien muokattava. |
| Preflight | Tilapäisessä hakemistossa tehtävä capability-, JSONL/Markdown-, parent-, dependency-, cycle- ja external-ref-validointi ennen Runia. |
| Canonical persistence | SQLiteen atomisesti commitoitu runtime-, State-, outcome-, control- ja tracker-intent-totuus. Ticket-store ei korvaa runtime-ohjausta. |
| Machine-local runtime state | `.git/ballet`-hakemiston SQLite-, worktree- ja lifecycle-data, jota ei versionhallita project truthina. |
| Runtime DB v13 | Nykyinen strict runtime schema. V12- ja vanhemmat kannat jätetään koskemattomiksi ja käynnistys antaa archive/remediation-ohjeen. |
| Policy option observation v3 | Immutable scoped havainto, joka yhdistää outcome/actual-state/model-match-evidenssin versionoituihin measured/unknown cost-dimensioihin ja inclusive attribution -viitteisiin. |

## Provider ja versionoidut sopimukset

| Termi | Määritelmä |
| --- | --- |
| Execution composition | Tavutasoinen järjestys System → primary instruction → vakaasti järjestetyt skillit → Task Envelope → role/output schema. |
| Strict output schema | Roolikohtainen koneellisesti validoitava tulosmuoto, jonka läpäisy tarvitaan ennen canonical outcomea. |
| Current runtime cut | Project Config V16, Root Snapshot V9, Task Envelope/outcome V8, prompt composition V9, ExecutionSpec V10, Graph Node Module V5 ja runtime DB V12. |
| Provider adapter | Portti, joka mapittaa canonical execution taskin provider-protokollaan ja normalisoi tapahtumat muuttamatta runtime-semanticsia. |
| No fallback | Puuttuva tai invalidi model/profile/provider/resource/tracker pysäyttää tehtävän eikä vaihdu hiljaisesti vaihtoehtoon. |

## Module ja käyttöliittymä

| Termi | Määritelmä |
| --- | --- |
| Graph Node Module V5 | Nykyinen portable package-sopimus. Moduuli exporttaa GraphNoden ja JobNodejen intrinsic outcome -sopimukset, Work/Validation/Repair-resurssit, explicit local `agent_v1` -strategian ja provenance-datan, mutta ei probabilityja, costeja, project-specific transitioneita tai upper-level appearancea. V4-lukijaa ei ole. |
| `externalWrites` | Module V5 permission metadata; arvo `requires-human-authorization` ilmaisee ulkoisen kirjoituksen portin. |
| Graph Engineering | Project-global capability-first authoring: URL-omisteiset `Capability Graph`- ja `Decision Model` -korttiosiot. Se ei ole runtime-ohjain eikä upper-level planet canvas. |
| Graph Node Engineering | Yhden GraphNoden capability-first authoring: URL-omisteiset `Jobs`- ja `Local Decision Model & Repair` -korttiosiot. |
| Job Node industrial flow | ADR-025/027:n suojattu Work → Validation → bounded retry -authoring-projektio. Work/Validation-artwork säilyy tällä tasolla, mutta näkymä ei valitse seuraavaa JobNodea. |
| Compile readiness | Scopekohtainen tieto siitä, että Decision Model läpäisee schema-, viite-, probability-, semantic outcome- ja proper-policy-validoinnin. Draftin voi tallentaa, mutta sitä ei saa käyttää Runissa. |
| Loop Module Package V3 | Historiallinen strict-v13 portable package-sopimus, jonka Graph Node Module V4 ja V5 ovat korvanneet. |
| Workflow Engineering | Historiallinen yhden Loopin editori ennen GraphNode/JobNode- ja capability-first-rajoja. |

## Arkkitehtuuri ja governance

| Termi | Määritelmä |
| --- | --- |
| Initiative | Rajattu muutos, jolla on BRIEF-, PLAN-, EVIDENCE- ja REVIEW-artefaktit. |
| Stable ID | Sisältöpäivityksissä säilyvä Goal/REQ/QS/ADR/CON/BB/RT/DEP/TEST/EVID-tunniste. |
| Trace chain | Goal/REQ → QS → ADR/CON → BB/RT/DEP → TEST/monitor → EVID -suhdeketju. |
| External write | Push, merge, release, deploy, rollback, viesti tai muu mutaatio hyväksytyn Root Run -worktreen ulkopuolelle. |
| Human authorization | Täsmällinen käyttäjän lupa tiettyyn ulkoiseen kirjoitukseen; yleinen toteutuspyyntö ei valtuuta deployta, mergeä tai pushia. |

## Kanoniset lähteet

Hyväksytyt Goalit/ADR:t, shared domain -sopimukset, `.ballet/project.json`, STATE-CONTRACT ja tracker-sopimus menevät tämän yhteenvedon edelle ristiriidassa. Ristiriita korjataan sanastoon eikä jätetä rinnakkaiseksi tulkinnaksi.

## Relevantit päätökset

`adr-002`, `adr-005`, `adr-007`, `adr-011`, `adr-013`, `adr-015`, `adr-016`, `adr-020`, `adr-021`, `adr-022`, `adr-023`, `adr-025`–`adr-030`.

## Evidenssi

Accepted active termit esiintyvät strict-v17 project configissa, shared contracts -rajapinnoissa ja runtime/persistencessä. V2-policy-, capability-first- ja observation v3 -termit traceutuvat ADR-028–030:een, QS-022–025:een, RT-017–019:ään sekä EVID-022–025:een; hyväksytty v1-baseline säilyy ADR-026/QS-021/RT-016/EVID-021-ketjussa.

## Avoimet kysymykset

- Termi lisätään vain, jos epäyhtenäinen tulkinta vaikuttaa arkkitehtuuriin, runtimeen, käyttöliittymään tai handoffiin.

## Seuraava katselmointiperuste

Katselmoi osio, kun uusi vakaa domain-termi hyväksytään tai evaluation löytää käytännössä haitallisen ambiguiteetin.
