---
id: adr-030
title: Policy-mallit kalibroidaan offline ja aktivoidaan hallitulla promootiolla
status: superseded
createdAt: '2026-08-23T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - policy
  - calibration
  - promotion
version: 3
---

# Policy-mallit kalibroidaan offline ja aktivoidaan hallitulla promootiolla

> Superseded by `adr-031`; calibration/shadow/promotion-arkkitehtuuri ei ole aktiivinen.

## Konteksti

Accepted ADR-026 kieltää probabilityjen history-derived-defaultit ja automaattisen RL/päivityksen. Accepted ADR-028 toteuttaa immutable `P(outcome,expectedNextState|state,action)` -mallin, projector-owned actual Staten ja havaintojäljen mutta rajaa probabilityjen ja costien automaattisen kalibroinnin ulos.

Ennen Phase 2 -leikkausta `PolicyOptionObservationV2` ja SQLite v12 pystyivät tallentamaan keston, valinnaisen `actualCostMicros`-arvon, toteutuneen outcomen/next staten sekä provenance-viitteet, mutta runtime producer ei asettanut `actualCostMicros`-arvoa. Provider-event-raja tunsi osan token usage -dimensioista, mutta niitä ei aggregoitu option observationiin yhdenmukaisesti. Sopimus ei määrittänyt täydellisiä provider-neutral usage-, retry-, monetary- tai utility-dimensioita, hierarchy-safe-attribuutiota, dataset-snapshotteja, candidate registryä, held-out-evaluationia, shadow-provenancea tai aktivointi-/rollback-politiikkaa.

## Päätösajurit

- `goal-019` / `REQ-019`, `QS-022`, `QS-023` ja `QS-025`.
- Immutable observation-, snapshot- ja model-provenance ilman in-place learningia.
- Joint `outcome × actual-next-state` -malli eikä kahden toisistaan riippumattoman marginaalin oletusta.
- Tuntemattoman kustannusdimension erottaminen mitatusta nollasta.
- Provider-neutral, project-local ja deterministisesti katselmoitava scalarization.
- Fail-closed readiness/evaluation sekä ihmisen säilyvä activation-, rollback- ja external-write-valta.

## Päätös

### Option-cost-evidenssi ja hierarkia

Jokainen toteutunut action observation säilyttää versionoidussa strict-sopimuksessa ainakin option wall-clock-keston, Work/Validation-yritykset, retry- ja repair-laskurit, canonical provider-neutral usage -dimensiot sekä tunnetut monetary/utility-dimensiot. Jokainen dimension arvo on joko mitattu tai eksplisiittisesti unknown; puuttuvaa arvoa ei normalisoida nollaksi. Provider-raw-evidenssi säilyy viitteenä, mutta providerin oma kenttänimi ei tule solverin contractiksi.

Kumpikin policy-scope kalibroidaan omista option-havainnoistaan:

- Graph-scope käyttää GraphNode Optionin inclusive kokonaiskustannusta.
- GraphNode-scope käyttää JobNode Optionin inclusive Work→Validation→bounded retry -kustannusta.
- Cross-scope-raportti ei koskaan summaa näitä kahta inclusive-arvoa. Se näyttää scopekohtaiset arvot tai GraphNode-kokonaisuuden ja erikseen johdetun exclusive overheadin child-observation-viitteineen.

Näin sama child-suoritus voi olla oikea local-option-kustannus ja osa global-option-kustannusta, mutta sitä ei lasketa kahdesti samassa aggregaatissa tai scalar cost -estimaatissa.

### Deterministinen scalarization

Project-local calibration policy luettelee sallitut kustannusdimensiot, yksiköt, integer/fixed-point-normalisoinnin, painot, cap/floor-säännöt ja required/optional-unknown-käyttäytymisen. Scalar cost johdetaan vain tästä versionoidusta säännöstä. Required-dimension unknown estää candidate-readinessin; optional unknown säilyy raportissa eikä lisää implisiittistä nollaa.

Solver saa edelleen yhden positiivisen safe-integer-microcostin per state/action-rivi. Multi-objective-optimointia ei piiloteta scalarizationin alle: uusi Pareto-, constraint- tai preference-learning-semantics vaatii oman ADR:n.

### Immutable dataset snapshot ja candidate registry

Offline calibration lukee vain commitoituja immutable observations-rivejä. Dataset snapshot sisältää exact observation-ID:t, rajaus-/exclusion-säännöt, schema-version, source database identityn, aikarajan, calibration code/version -viitteen ja canonical SHA-256-hashin. Snapshot ei kopioi shadow-actionia observed counterfactualiksi.

Candidate model artifact sisältää vähintään dataset-hashin, expert-prior-konfiguraation hashin, joint `outcomeId × actualNextStateId` -estimaatit, cost-estimaatit, sample/coverage/readiness-tulokset, capability/feature/state/action-catalogien hashit, solver/evaluation-konfiguraation, parent/promoted-model-viitteet ja oman canonical hashin. Artifact on content-addressed ja immutable; uusi kalibrointi tuottaa uuden artifactin.

Registry on append-only index immutable dataseteille, candidateille, evaluation reporteille, promotion proposal -tapahtumille, human activationeille ja rollback-aktivoinneille. Artifactin statusta tai sisältöä ei muuteta in place.

### Priors, readiness ja evaluation

Joint categorical -estimaatti käyttää eksplisiittisiä project-local expert pseudo-count -prioreita. Havainto ei muuta prior-konfiguraatiota. Calibration policy määrittää vähimmäissamplet, action/state-coverage-rajan, unknown/missing-cost-rajan ja muut readiness-ehdot; arvoja ei päätellä runtime-historiasta.

Evaluation sisältää käytännöllisessä finite-mallissa exact policy evaluationin, deterministic seeded simulation -ristiintarkistuksen, held-out joint predictive -mittarit, cost error -mittarit, proper-policy/guard-checkin ja sensitivity-analyysin. Promotion proposal syntyy vain, kun kaikki nimetyt project-local-thresholdit täyttyvät. Insufficient evidence tuottaa fail-closed `not_ready`-tuloksen eikä ehdotusta.

### Shadow mode

Shadow mode snapshottaa erikseen controller-strategian ja yhden exact candidate model hashin. `agent_v1` tekee ainoan control-päätöksen. Shadow `ssp_v2` saa saman canonical Decision Staten, snapshotatun capability/action-unionin ja hard admissible setin ja persistoi oman decision/evaluation-provenancensa ilman dispatchia.

Controllerin valittu action voidaan observationa liittää myös shadow-modelin ennusteeseen vain toteutuneen actionin osalta. Shadow'n valitsema mutta controllerin toteuttamatta jättämä action ei tuota outcome-, next-state- tai cost-havaintoa.

### Promotion, activation ja rollback

Automaatiolla on oikeus tuottaa immutable candidate, evaluation report ja promotion proposal. Se ei saa muuttaa live model referenceä.

Project owner aktivoi exact model hashin eksplisiittisellä päätöksellä. Aktivointi vaikuttaa vain sen jälkeen luotuihin Root Run -snapshotteihin. Running snapshot, historiallinen havainto ja aiempi artifact muuttuvat nolla kertaa. Rollback on uusi ihmisvaltuutettu activation-eventti aiempaan immutable model hashiin, ei artifactin muokkaus tai tietokantahistorian palautus.

Pilotin target, outcome-katalogit, priors, scalarization, thresholds, model hash, budgetit, stop-ehdot ja external-write-raja pitää nimetä canonical project artifactissa ennen executionia. Promotion ei valtuuta deployta, releasea, mergeä, pushia tai muuta external writea.

### Strict contract cut ja Portti B

Phase 2 tekee yhden koordinoidun hard cutin ilman compatibility-readeria, dual-writeä tai runtime-migraatiota: Project Config v17, Root Snapshot v10, policy observation v3 ja SQLite v13. Graph Node Module säilyy v5:nä, koska package-raja ei muutu. Seuraavat calibration/registry/shadow/promotion-slicet jatkavat näistä versioista ja bumpaavat vain tosiasiassa muuttuvat strict producerit ja consumerit.

ADR-028:n review-tekstissä Portti B:lle ennakoidut v17/v10/v13-numerot siirtyvät tämän ehdotuksen hyväksynnän jälkeen vähintään seuraaviin vapaisiin versioihin. Portti B:n exact version matrix päätetään vasta sen erillisessä hyväksyntärajassa; tämä ADR ei valtuuta agent-routerien poistoa.

## Seuraukset

- Observation- ja registry-pinta kasvaa, mutta historical evidence ja running snapshots pysyvät immutableina.
- Domain expertin pitää authoroida prior-, cost- ja threshold-arvot; niiden puuttuminen pysäyttää candidate-readinessin.
- Shadow tuottaa policy-comparison-evidenssiä mutta ei tunnistamatonta counterfactual dataa.
- Human activation hidastaa automaattista loopia tarkoituksella ja säilyttää live-routing-vallan.
- Scopekohtainen kustannusmalli säilyttää SMDP Option -semantiikan ilman hierarchy double countingia.

## Hylätyt vaihtoehdot

- **Online posterior update aktiiviseen malliin:** hylätty, koska se rikkoo immutable snapshotin ja review-rajan.
- **Tuntematon monetary/usage-arvo nollana:** hylätty, koska se vääristää cost estimatea ja promotion-päätöstä.
- **Outcome- ja next-state-marginaalien erillinen estimointi:** hylätty, koska se kadottaa niiden riippuvuuden.
- **Global- ja local-inclusive-costien summaaminen:** hylätty hierarchy double countingina.
- **Shadow'n valitsematon action observationa:** hylätty, koska outcomea, next statea tai costia ei havaittu.
- **Thresholdit platform-koodissa:** hylätty, koska calibration/promotion-intentio on project-local ja vaatii omistajan hyväksynnän.
- **Automaattinen live activation:** hylätty; automaatio saa ehdottaa, ihminen aktivoi exact hashin.
- **In-place rollback:** hylätty; rollback viittaa aiempaan immutable artifactiin uutena activation-eventtinä.

## Evidenssi ja review trigger

Trace on `goal-019` / `REQ-019`, `QS-025`, `adr-030` / `CON-012`, `BB-005`, `BB-011`, `BB-012`, `RT-019`, `TEST-025`, `EVID-025` ja initiative `governed-policy-calibration-and-promotion`.

Project owner hyväksyi ADR:n commitissa `26698dda09c9e9fda5284d4bfa578d6084581dc5`. Uusi ADR vaaditaan online learningille, automaattiselle activationille, profile-aware Optioneille, permission/network-rajan policy-laajennukselle tai Portti B:n agent-routerien poistolle.
