---
id: adr-026
title: Graph-scope käyttää eksplisiittistä finite SSP/SMDP -policystrategiaa
status: superseded
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-22T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - policy
  - ssp
  - smdp
version: 3
---

# Graph-scope käyttää eksplisiittistä finite SSP/SMDP -policystrategiaa

> Superseded by `adr-031`; historiallinen perustelu säilyy audit trailina.

## Status ja päätöstarve

Projektin omistaja hyväksyi tämän ADR:n ja sen strategy-, proper-policy-, solver-bound- sekä strict v15/v8/v11 -päätökset 2026-08-22. ADR supersedoi `adr-023`:sta vain Graph-scopeen kuuluvan väitteen, että tavallisen seuraavan GraphNoden valitsee aina LLM-orchestrator. Kolmitasoinen domain, käyttäjän määrittelemät GraphNodet, GraphNode-scope, Job-invariantit, State, snapshot, repair, worktree, tracker ja ihmisvaltuutus säilyvät.

## Konteksti

Nykyinen `ProjectOrchestrator` snapshottaa `start`, `continuation` ja `repair` candidate-säännöt, muodostaa strict target-enumin ja pyytää LLM:ää valitsemaan yhden targetin. Runtime validoi foreign targetin nollavaikutukseksi ja persistoi routing request/decision -evidenssin. Ratkaisu rajaa agentin toimivaltaa, mutta itse reitityspolitiikka jää promptin ja mallin sisään: transition-oletuksia, odotettua kustannusta, action valueja tai proper-policy-ehtoa ei voi tarkastaa standardina päätösmallina.

Tarvitaan geneerinen Graph-scope, jossa käyttäjän GraphNode on SMDP Option, Graph Orchestrator toimii decision epocheissa ennen ensimmäistä GraphNodea ja jokaisen GraphNode-terminaalin jälkeen ja policy minimoi odotettua kokonaiskustannusta kohti eksplisiittistä success-terminalia. Malli ei saa hardkoodata GraphNode-ID:itä tai keksiä probabilityjä.

## Päätösajurit

- `goal-002`, `goal-006`, `goal-007`, `goal-016` / `REQ-016` ja `QS-021`.
- Immutable snapshot, deterministic reproducibility, inspectable decisions ja restart-safe evidence.
- Hard safety/control invariants erotetaan reward/cost-mallista.
- 1–40 user-defined GraphNodea ilman schema- tai platform-haaraa nodejen nimille.
- Ensimmäinen versio on rajattu, finite ja implementation-ready ilman learning-järjestelmää.

## Päätös

### Yksi orchestration runtime, kaksi eksplisiittistä Graph-strategiaa

Graph konfiguroi täsmälleen yhden strategian:

- `agent_v1`: nykyinen strict candidate enum + LLM-orchestrator -päätös; tai
- `ssp_v1`: bounded Decision State + explicit SSP/SMDP model + deterministic policy solver.

Strategia on snapshottava discriminated union, ei fallback-ketju. `ssp_v1`-virhe ei kutsu `agent_v1`:tä, ja `agent_v1` ei käytä SSP-arvoja piiloprompttina. GraphNode-scope säilyy ensimmäisessä toteutuksessa `agent_v1`-strategialla.

Pre-production strict cut on project config v15, Root Snapshot v8 ja SQLite v11. Graph Node Module v4 sekä provider Task Envelope/outcome v7, composition v8 ja ExecutionSpec v9 säilyvät, koska Decision Model on Graph-global eikä ensimmäinen slice lisää provider-roolia.

### Capability Graph

Capability Graph on repository-backed Graph/GraphNode-rakenne ja sen hard candidate/admissibility metadata. GraphNode-ID on action key. GraphNode voidaan lisätä, nimetä uudelleen tai poistaa muuttamalla project-dataa ja kaikki ID-viitteet atomisesti; platformin enum, branch tai migration ei muutu.

Nykyiset start/continuation/repair-säännöt muutetaan yhteisen Capability Graph -rajan alle. `ssp_v1`:ssä start/continuation-säännöt voivat sisältää vain GraphNode-targetteja; terminalit eivät ole actioneita. Repair-säännöt säilyvät erillisinä capability/containment-rajoina.

### Decision State

`DecisionStateV1` ei ole project Staten alias. Se on decision epochissa deterministisesti johdettu, canonicalisoitu ja hashattu finite feature vector, joka mapataan yhteen eksplisiittiseen `decisionStateId`:hen.

Pitkän aikavälin feature source -lajit ovat rajattu enum:

1. canonical runtime facts: `epoch_kind`, previous/current GraphNode stable ID, verified GraphNode result, bounded invocation/repair counters;
2. bounded project State JSON Pointer, jonka output-domain on konfiguroitu enum;
3. permission/human-authorization fact, jonka domain on eksplisiittinen enum; ja
4. optional classifier observation, jonka output on yksi konfiguroidun enumin arvo ja jonka evidence/provenance validoidaan ennen käyttöä.

Ensimmäinen implementation slice sisältää vain kohdat 1–3. Classifier observation on extension boundary, joka vaatii oman provider-task/output-contract-suunnittelun ja ihmisarvion; näin Task Envelope/outcome v7, composition v8 ja ExecutionSpec v9 eivät muutu ensimmäisessä sliceissä.

Jokaisella featurellä on finite domain, exact missing/unknown-semantics ja stable ID. Jokainen state catalog -rivi antaa arvon jokaiselle featurelle. Puuttuva, domainin ulkopuolinen tai useaan stateen osuva projektio on `decision_state_invalid` ja pysäyttää fail-closedisti ilman actionia. Dokumentteja, diffejä, promptteja, lokeja tai vapaata tekstiä ei kopioida Decision Stateen.

### GraphNode Option

GraphNode `o` vastaa Options frameworkin temporaalisesti laajennettua actionia:

- initiation set `I_o`: GraphNode kuuluu snapshotiin, current Capability Graph -sääntöön ja Decision Modelin state/action-riviin sekä läpäisee permission/authorization-guardit;
- internal policy `π_o`: nykyinen GraphNode Orchestrator, JobNode Work/Validation ja bounded retry/repair;
- termination `β_o`: 1 vasta, kun GraphNode invocation on canonical `PASS | FAIL | blocked | failed` -rajalla ja seuraava Decision State voidaan projisoida, muutoin 0.

Graph-solver ei ohjaa JobNodeja eikä korvaa same-Validation repair-returnia. Option kesto ja toteutunut cost ovat observation-evidenssiä; ensimmäinen solver käyttää malliin konfiguroitua expected scalar costia.

### Admissible action set

`A(s)` on leikkaus:

```text
snapshot GraphNode membership
∩ Capability Graph candidate membership
∩ Decision Model state/action membership
∩ permission and human-authorization guards
∩ runtime lifecycle invariants
```

Poissuljettu action persistoi reason code -evidenssin mutta ei saa `Q(s,a)`-arvoa. Unauthorized/out-of-snapshot-actionia ei koskaan mallinneta suurella kustannuksella.

### Transition- ja kustannusmalli

`ProjectSspDecisionModelV1` luettelee jokaiselle nonterminal `stateId + graphNodeId` -parille:

- yhden positiivisen `expectedCostMicros`-kokonaisluvun; ja
- successor-listan `{ nextStateId, probabilityPpm }`, jossa `probabilityPpm` on kokonaisluku 1–1 000 000 ja rivin summa on täsmälleen 1 000 000.

Successorit ovat uniikkeja ja kuuluvat samaan state catalogiin. Runtime ei täydennä puuttuvaa riviä, normalisoi summaa, käytä uniform-oletusta tai johda prioriä historiasta. Malli, featuret, terminalit, solver config ja Capability Graph snapshotataan canonical JSONina ja SHA-256-hashataan.

Ensimmäisen version cost on yksi project-defined abstrakti scalar-mikroyksikkö. Token-, latency-, retry-, repair-, interruption- ja riskimittareita voidaan kerätä erillisinä observation dimensions -kenttinä, mutta niitä ei yhdistetä automaattisesti solver-costiksi. Multi-objective/weighted cost vaatii uuden ADR:n.

### Terminalit ja proper policy

State catalog merkitsee terminalin täsmälleen yhdeksi arvoista `success | failure | blocked`. Terminalit ovat absorbing, niiden action set on tyhjä ja runtime mapittaa ne Root Runin canonical terminal-statukseen. Candidatejen puuttuminen ei tarkoita completionia.

`success` on SSP-goal ja sen arvo on 0. `failure` ja `blocked` eivät ole goal-tiloja; solver käsittelee niitä sekä goalista irrallisia recurrent classeja äärettömänä expected remaining costina. Validin mallin pitää sisältää jokaiselle sallitulle nonterminal lähtötilalle vähintään yksi proper policy, joka saavuttaa successin todennäköisyydellä 1. Näin policy ei voi valita halpaa epäonnistumista eikä ihmisrajaa kierretä terminal-costilla.

### Solver

Ensimmäinen solver on finite undiscounted SSP value iteration Bellman-päivityksellä:

```text
V(goal) = 0
Q(s,a) = c(s,a) + Σ P(s'|s,a) V(s')
V(s) = min a∈A(s) Q(s,a)
π(s) = argmin a∈A(s) Q(s,a)
```

Preflight tarkistaa exact fixed-point probabilityt, finite cardinalityn, explicit terminalit, non-empty `A(s)`-joukot ja almost-sure success -alueen standardilla graph/MEC-analyysillä. Failure/blocked ja almost-sure-alueen ulkopuoliset successorit saavat arvon `∞`. Positiiviset stage costit varmistavat, että improper policyllä on ääretön cost.

Laskenta käyttää stable state/action/successor-ID-järjestystä, IEEE-754 doublea vain fixed-point-inputin jälkeen ja kompensoitua summausta. Default-rajat ovat 1 024 statea, 40 actionia/state, 40 960 transition outcome -riviä, `epsilon = 1e-9`, `maxIterations = 10 000` ja `maxSolveMillis = 2 000`. Konvergenssi vaatii Bellman-residualin `≤ epsilon`; lopuksi valitun policyn bottom-SCC-analyysin pitää osoittaa almost-sure success. Virhe, timeout, NaN/Infinity-aritmetiikka, residualin jääminen yli rajan tai improper selected policy tuottaa `policy_model_invalid | policy_no_proper_policy | policy_not_converged`, actioneita 0 ja Root Run `needs_input`/failed accepted runtime error mappingin mukaan.

Tasatilanteessa kaikki `|Q(s,a)-minQ| ≤ epsilon` -actionit persistoidan tiedoksi ja valinta tehdään lexicographic stable GraphNode ID:llä. Sama snapshot ja Decision State tuottavat samat policy/hash/Q-arvot.

### Snapshot, persistence ja kolme runtime-näkymää

Immutable Root Snapshot sisältää Capability Graphin, strategy discriminantin, feature definitions/state catalogin, transition/cost/terminal-mallin, solver/projection-limitit, max-permission-boundaryn, resource closuren sekä canonical decision model hashin.

Jokaisesta decision epochista persistoidan vähintään:

- state ID, canonical feature vector ja hash sekä source revision/evidence refs;
- admissible actionit ja excluded action reason codet;
- valittu action, kaikki finite `Q(s,a)`-arvot, `V(s)`, tasatilanne ja tie-break;
- solver algorithm/version, iterations, residual, epsilon, status, policy hash, model hash ja snapshot hash; sekä
- epoch source, previous option/outcome, timestamp ja atomic dispatch/terminal control fact.

Option terminaalin jälkeen persistoidan `(state_before, action, configured_expected_cost, observed_cost_dimensions, verified_outcome, state_after, duration, decision/model/snapshot refs)`. Observation ei muuta model JSONia.

Configure omistaa Capability Graphin ja Decision Modelin. Run omistaa read-only Decision Staten, `A(s)`:n, policy decisionin, Q/V-evidenssin, bounded Policy Projectionin ja factual Execution Graphin. Policy Projection on korkeintaan 20 decision epochin ja 100 projection-noden deterministic rollout, joka katkaisee cycleen/horizoniin ja näyttää branch/cumulative probabilityn; sitä ei tallenneta workflow source of truthiksi.

### LLM:n rooli

`agent_v1`:ssä LLM säilyy Graph-route-päätöksentekijänä. `ssp_v1`:ssä LLM ei valitse GraphNodea eikä korvaa Bellman-ratkaisua. LLM/verifier voi tuottaa vain strict enum -observationin, summaryn ja evidence refs -viitteet; runtime validoi ne ja projisoi Decision Staten. Classifierin puuttuminen tai invalidi output pysäyttää, ei vaihda strategiaa.

## Mielivaltainen GraphNode-esimerkki

Project voi määrittää GraphNodet `discover`, `prototype`, `security-check`, `package` ja `publish`. State catalog voi sisältää `unknown`, `concept-ready`, `security-cleared`, `published` ja `blocked`; vain `published` on success-terminal. `unknown + discover` voi konfiguroidusti siirtyä `concept-ready`-tilaan 900 000 ppm ja takaisin `unknown`-tilaan 100 000 ppm kustannuksella 2 000 microa. Kaikki probabilityt ja costit ovat project-dataa.

Jos `prototype` nimetään `experiment`iksi, project owner päivittää stable action -viitteet candidate-, cost- ja transition-riveissä. Parseri hylkää stale-viitteen atomisesti. Platform-koodiin, solveriin, SQLite-semanticsiin tai UI:n node-name-enumiin ei tule muutosta. Sama generic fixture testataan myös kokonaan toisilla ID:illä.

## Seuraukset

- Routing muuttuu eksplisiittiseksi, inspectableksi ja standardiin MDP/SSP/SMDP-käsitteistöön mapattavaksi ilman toista workflow engineä.
- Authorointi vaatii domain ownerilta bounded state abstractionin, probability-priorit, pozitiviiset cost-arvot ja terminal objective -määrittelyn; Ballet ei voi päätellä niitä turvallisesti.
- Proper-policy-raja on tarkoituksella konservatiivinen: malli, jossa success ei ole almost sure, ei ole ensimmäisen version ajettava SSP.
- Existing agent strategy voidaan säilyttää tietoisena strategiana niille Grapheille, joilla päätösmallia ei ole; SSP-virhe ei fallbackaa siihen.
- Persistence ja Run UI kasvavat, mutta Capability/Policy/Execution-näkymät pysyvät source-of-truth-rajoiltaan erillään.

## Hylätyt vaihtoehdot

### LLM palauttaa Q-arvot tai “optimoi” kustannusta promptissa

Hylätty, koska model ei olisi standardi, toistettava tai numeerisesti validoitava ja LLM jäisi hidden policyksi.

### Unauthorized action suurella costilla

Hylätty, koska safety/authorization ei ole preference. Action poistetaan `A(s)`:stä.

### Project State suoraan MDP-stateksi

Hylätty, koska arbitrary JSON voi olla rajaton, non-Markov, epäkelpo finite solverille ja sisältää dokumentti-/lokikopioita.

### Puuttuville probabilityille uniform- tai history-derived-default

Hylätty, koska se keksisi domain-oletuksen ja muuttaisi policya ilman reviewoitua project-dataa.

### Failure-terminalille konfiguroitu suuri penalty ensimmäisessä versiossa

Hylätty, koska penaltyn suuruus voisi tehdä epäonnistumisen tahallisesti optimaaliseksi. Proper-policy + infinite non-goal terminal säilyttää SSP-goalin yksiselitteisenä.

### Moniulotteinen weighted score heti

Hylätty, koska painot ja normalisointi loisivat uuden vaikeasti hyväksyttävän päätöspinnan ennen scalar-mallin evidenssiä.

### Automaattinen RL / probability update

Hylätty ensimmäisestä versiosta. Execution Graph kerää samplet, mutta learning proposal vaatii oman Goal/QS/ADR:n ja ihmisarvion.

## Evidenssi ja review trigger

Trace on `goal-016` / `REQ-016`, `QS-021`, `adr-026`, `CON-012`, `BB-011`, `RT-016`, `TEST-021`, `EVID-021` ja initiative `stochastic-policy-orchestration`.

ADR hyväksyttiin proper-policy/failure-semanticsin, strategy coexistence -rajan, fixed-point-esitysten, solver-boundsien ja strict version cutin osalta. Uusi ADR vaaditaan multi-costille, online learningille, POMDP-stateen, recursive Job-solverille, probability-autoupdatelle tai active snapshot -mallin muuttamiselle.
