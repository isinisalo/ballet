---
id: arc42-section-08
title: Poikkileikkaavat konseptit
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 21
tags:
  - arc42
  - concepts
arc42Section: 8
---

# 8. Poikkileikkaavat konseptit

## Tarkoitus

Tämä osio selittää useaan rakennusosaan vaikuttavat, laatutavoitteista johdetut ratkaisuperiaatteet. Se ei ole kaikkien ohjelmointikäytäntöjen katalogi. Konsepti kuuluu tänne, kun sen rikkominen muuttaisi usean BB:n turvallisuutta, determinismiä, palautumista, evidenssiä tai operaattorin tulkintaa.

## Tila

CON-001–CON-010 säilyvät yleisinä tai historiallisina konsepteina. CON-011/012 ovat vanhaa routing/learning-jakoa ja CON-013 single-policy-raja. CON-014 omistaa aktiivisen strict-v19 hierarchical Reward-MDP:n phase-09 cutoveriin asti. CON-015 omistaa hyväksytyn Validation-led Environment-targetin poikkileikkaavat invariantit.

## Konseptikartta

| ID | Konsepti | Soveltuu | QS | Toteutusankkurit |
| --- | --- | --- | --- | --- |
| CON-001 | Least-authority local execution: loopback API, eksplisiittinen Origin-politiikka, worktree-only Node-kirjoitukset, network-off-oletus ja ihmisen external-write-valtuutus. | BB-002, BB-004, BB-006, BB-007 | QS-001, QS-004, QS-007 | ADR-006, ADR-008, workspace permission policy |
| CON-002 | Durable canonical control: strict role outcomes, atomiset State- ja acceptance-ledger-patchit, append-only revisionit, bounded Validation retry ja runtime-owned continuation. | BB-004–BB-006 | QS-003, QS-012, QS-015 | ADR-015, ADR-020, ADR-031, runtime/state/queue-storet |
| CON-003 | Deterministinen execution composition: System → primary → vakaasti järjestetyt skillit → `TaskEnvelope` → role/output schema, kaikki snapshotattuna ja hashattuna. | BB-003, BB-004, BB-006 | QS-002, QS-004, QS-011 | ADR-012, ADR-013, `ExecutionComposition` |
| CON-004 | Siirrettävät project resources: repository-polut omistavat configin, dokumentit, instructionit ja skillit; machine state jää `.git/ballet`-hakemistoon. | BB-003, BB-008, BB-009 | QS-002, QS-005, QS-009 | ADR-002, ADR-014, ADR-016, resource catalog |
| CON-005 | Cyber-industrial operator UI ja canonical projection: dense, accessible, token-driven React/Tailwind/shadcn-pinnat näyttävät vain nimetyn runtime/project-totuuden. Capability-first cards omistavat upper-level-authoringin ja protected industrial flow vain Action Noden. | BB-001, BB-002, BB-005 | QS-001, QS-010, QS-013, QS-020, QS-024 | [DESIGN.md](../../DESIGN.md), `CapabilityCards.tsx`, `DecisionModelWorkspace.tsx`, `ActionFlowCanvas.tsx`, Graph Reward-MDP Run read models |
| CON-006 | Evidenssipohjainen arc42 Method: stable ID:t, väitetyypit, initiative handoff, traceability, conformance ja mitattu method health. | BB-003–BB-005, BB-008 | QS-005, QS-006, QS-008 | goal-009, ADR-011, project-local arc42-resurssit |
| CON-007 | Copy-to-project module trust: strict rajattu JSON, canonical hash, deterministic namespace, compatible profile slots, revalidated plan, config-last commit ja content-derived provenance. | BB-001–BB-003, BB-009 | QS-002, QS-004, QS-009 | ADR-016, Loop module schemas/service/tests |
| CON-008 | Action integrity: jokainen ActionNode omistaa yhden Workin ja yhden Validationin; local policy valitsee ActionNoden ja Validation retry on bounded. Canvas projisoi aggregate-sopimuksen ilman authoroitavia child Edgejä. | BB-001, BB-003–BB-006, BB-009, BB-014 | QS-003, QS-009, QS-027 | ADR-020 säilyvin osin, ADR-033, strict v19 schema/runtime |
| CON-009 | Named RunBook determinism: Graphin `(source, decision, outcome)` on yksikäsitteinen, Validation valitsee vain snapshotatun enumin, runtime ratkaisee exact transitionin, DONE on eksplisiittinen ja transition count rajattu. | BB-001, BB-003–BB-006, BB-009 | QS-016, QS-017 | ADR-022, v13 schema, v6 snapshot/envelope/outcome, GraphRunbookEngine |
| CON-010 | Tracker reconciliation: SQLite outbox on runtime-intention canonical lähde, external-ref on idempotenssiavain ja Run etenee vasta strict `tk`-sovituksen jälkeen; bounded State sisältää vain viitteitä. | BB-004, BB-005, BB-010 | QS-012, QS-018 | ADR-007, ADR-022, runtime schema v9, TkTracker, TrackerOutbox |
| CON-011 | Scoped agent routing and repair containment: Graph- ja Graph Node -orchestrator saavat vain snapshotatun parent-scope-enumin; Work→Validation ja retry ovat Job-aggregaatin kiinteitä invariantteja; invalidi target ei vaikuta, bounded Repair ei laajenna targetteja/oikeuksia ja palaa samaan Validationiin. Job industrial flow näyttää Work/Validation-, retry- ja terminaalimerkit; Graph Node Orchestrator omistaa routingin ilman Job-canvasin parent-junctionia. | BB-001, BB-003–BB-006, BB-009 | QS-019, QS-020 | ADR-023, ADR-025, ADR-027, v14 schema, v7 snapshot/envelope/outcome, GraphRoutingEngine, EngineeringShell |
| CON-012 | Finite policy boundary: Capability Model omistaa outcomes/actions/hard guards; bounded Decision State projisoi Markov-relevantit canonical factsit; Decision Model omistaa `P(outcome,nextState|state,action)`/cost/terminalit; sama solver tuottaa global/local Q/V/actionin; actual state tulee aina projectorilta. Policy Projection on derived evidence ja Execution Graph factual observations. Hard controls poistavat actionin `A(s)`:stä, probabilityt/costit eivät mutatoidu runtime-observationista. | BB-001–BB-005, BB-011, BB-012 | QS-002, QS-012, QS-013, QS-021–QS-025 | ADR-026, ADR-028, ADR-030, config v17/snapshot v10/observation v3/SQLite v13, RT-016/RT-019 |
| CON-013 | Historiallinen single Graph Reward-MDP boundary. Outcome-aware reward, immutable authorization ja deterministic compiler säilyvät CON-014:ssä; ledger-state-katalogi ja single policy eivät. | BB-013 | QS-026 | ADR-031, RT-020 |
| CON-014 | Hierarchical node-owned policy boundary: `S=A` johdetaan GraphNode- tai ActionNode-ID:istä; terminalit ovat branch targetteja; Graph/local policyt compileerataan erikseen; observed typed outcome valitsee branchin; acceptance-ledger/effectit portitetaan Graph-rajalla eikä niitä mallinneta local stateksi/rewardiksi. | BB-001–BB-005, BB-009, BB-014 | QS-002, QS-003, QS-012, QS-013, QS-027 | ADR-033, config v19/snapshot v12/decision+observation v5/SQLite v15, RT-025 |
| CON-015 | Validation-led Environment integrity: approved Use Case ja immutable snapshot rajaavat Runin; unique State order / Action priority määräävät etenemisen; runtime status johtaa `done`/`blocked`-arvot; Validation yksin ohjaa precheck/Work/postwork/retryn; blocked+Feedback on atominen; Critic/Refinement vaativat typed human approvalin; exact hash -apply luo immutable continuation Runin. | BB-001–BB-008, BB-010, BB-015 | QS-028–QS-032 | ADR-034, Project Config v20 / Snapshot v13 / role v10 / composition v11 / ExecutionSpec v12 / SQLite v16 / Feedback-Critic-Refinement v1, RT-026–RT-028 |

## Turvallisuus ja auktorisointi

Turvallisuus muodostuu useasta erillisestä portista:

1. **Checkout identity:** palvelu palvelee yhtä ratkaistua checkoutia.
2. **Request validation:** shared schema ja HTTP boundary estävät malformed-inputin ennen käyttötapausta.
3. **Snapshot/preflight:** target, reachable graph, resource closure, profiili, oikeudet ja pinnattu `tk` validoidaan ennen queuea.
4. **Workspace policy:** providerin kirjoitusalue on Root Run -worktree ja verkko riippuu profiilista.
5. **Outcome validation:** provider-output ei ole canonical ennen role/output-skeemaa.
6. **External effect:** merge, push, release, deploy ja rollback vaativat täsmällisen ihmisvaltuutuksen, vaikka muut portit olisivat läpäisty.

Authentication-palvelua ei lisätä loopback-arkkitehtuuriin implisiittisesti. Tämä ei tee kaikesta paikallisesta inputista luotettua: Origin, checkout, schema, package trust ja provider output validoidaan omissa rajoissaan.

## Validointi ja virheiden käsittely

| Raja | Validointi | Virheen muoto | Sivuvaikutus |
| --- | --- | --- | --- |
| Project config/resources | Strict-v19 Graph/global policy/GraphNode/local policy/ActionNode/acceptance -rakenne ilman legacy-readeria, dual-writeä tai silent compatibilityä. | Tarkka issue-lista; incomplete-matriisi voidaan tallentaa mutta Run estyy. | Ei osittaista config- tai Run-muutosta. |
| HTTP/API | Shared request/response schema ja application precondition. | 4xx odotetulle inputille, 5xx vain odottamattomalle virheelle. | Service-transaktio ei ala malformed-inputilla. |
| Composition | Profiili, instructionit, skillit, order, envelope ja output schema. | `ExecutionCompositionError` tai vastaava blocking outcome. | Nolla jonotettua taskia ja nolla fallbackia. |
| Runtime outcome | Roolikohtainen strict schema, current revision ja rajat. | Failed/needs_input/interrupted/terminal outcome. | Vain atomisesti commitoitu fakta näkyy. |
| Graph Node module | Koko, UTF-8, strict v7 schema, canonical hash, explicit mapping, täydellinen local policy, peer/acceptance-raja, conflict, stale plan ja active Run. | Domain issue -lista. | Config-last ja rollback; uusi global-solu jää näkyvästi incompleteksi. |
| `tk` adapteri | Capability probe, strict JSONL/Markdown, external-ref, parent/dependency, cycle, cwd/store, timeout ja output limit. | Preflight issue tai pending/error outbox. | Root Run/provider/transition ei etene; ulkoinen osittainen vaikutus sovitetaan Resume/startupissa. |
| UI projection | Shared DTO ja exhaustive presentation mapping. | Unknown/explicit unavailable; ei arvattua tilaa. | Display-only; canonical data ei muutu. |
| Draft Reward-MDP | Node-derived ID:t, explicit initial, sparse required cells, unique outcomes, exact ppm, targetit, local emit, guards, integer rewardit, absorption ja stable tie-break per scope. | Typed model/state/solver issue. | Action/dispatch = 0 ja project model ennallaan. |
| Target Environment | Approved Use Case trace, unique positive `order`/`priority`, instruction headings, resource closure, permissions ja active-run lock. | Typed vNext/target issue phaseen mukaan. | Run/queue/worktree = 0; v19-dataa ei lueta tai kirjoiteta. |
| Target Validation/outcome | Roolikohtainen enum, attempt/revision, `1 + maxRetries`, status transition ja atomic Feedback invariantti. | Typed semantic tai provider failure; niitä ei muunneta toisikseen. | Invalidi outcome = 0 statusmuutosta; blocked/retry exhaustion = yksi status+Feedback-commit. |
| Critic/Refinement approval | Proposal state, human identity, expected revision, base/diff/preimage hash, allowed path ja authoring lock. | Conflict/rejected/expired/approved typed result. | Ennen hyväksyntää tai driftissä repository/Feedback/continuation-muutoksia 0. |

Virheet ovat domain-faktoja vain, kun ne on persistentoitu oikeaan storeen. Logirivi tai providerin teksti ei yksinään muuta control flow’ta. Retry on rajattu runtime-sääntö, ei yleinen “catch and try again” -käytäntö.

## Persistence, atomisuus ja idempotenssi

- SQLite on machine-local canonical runtime truth; repository on canonical project truth.
- State-revisio käyttää monotonista revisionia ja expected-revision-tarkistusta.
- Outcome, revision ja control-flow-tapahtuma commitoidaan yhdessä, jos niiden erottaminen voisi näyttää mahdottoman välitilan.
- Queue/task lifecycle on persistentoitu: queued voidaan palauttaa, running muuttuu restartissa interrupted-tilaan eikä terminal-tulosta replayata.
- Cancellation/finalization toimii durable barrierina myöhäiselle adapter-payloadille.
- Module commit revalidoi suunnitelman ja kirjoittaa project configin viimeisenä, jotta config ei koskaan viittaa vielä puuttuvaan resurssiin.
- Tracker-operaatio kirjoittaa intentin ensin SQLite-outboxiin. Ulkoisen komennon onnistunut external-ref/linkki commitoidaan ennen control-flow'n jatkoa; retry/restart sovittaa saman intentin eikä luo uutta identiteettiä.

## Determinismi ja provenance

Compositionin järjestys, resolved resource -sisältö, role schema, Task Envelope ja hash ovat osa suoritusevidenssiä. Provider tai adapteri ei valitse toista profiilia, mallia, instructionia tai skilliä puuttuvan tilalle. Runtime muodostaa hard `A(s)`:n immutable authorization-snapshotista; providerin teksti tai project State ei voi laajentaa joukkoa. Graph Node Module canonicalization tuottaa sisältöpohjaisen hashin; asennettu provenance kertoo, mistä materialisoitu project-local-sisältö on peräisin. Immutable Root Run -snapshot estää myöhempää config-muutosta muuttamasta ajon selitystä.

CON-014 ulottaa saman provenance-periaatteen jokaiseen policy-scopeen: canonical node-ID/action/outcome/target/reward/solver JSON tuottaa scopekohtaisen model hashin. Integer-mikroyksiköt, exact PPM, iteration count, residual sekä Q/V/policy hash ovat decision evidenceä. Scope-tagged observation viittaa immutableen modeliin mutta ei mutatoi sitä.

CON-015 korvaa phase-09 cutoverissa policy-provenancen execution-lineagella: approved Use Case, target config hash, Root Snapshot, Action status revision, Validation/Work invocationit, Feedback, proposal, human approval, exact diff/preimage, commit ja continuation parent ovat append-only-viitteitä. Product Snapshot projisoi tämän lineage-ketjun mutta ei omista sitä.

## Evidenssi, observability ja tietoluokitus

### Väiteluokat

- **Fakta:** suoraan todennettava hyväksytystä lähteestä, koodista, konfiguraatiosta tai nimetystä evidenssistä.
- **Päätös:** hyväksytty valinta, jonka omistaa Goal/ADR tai eksplisiittisesti valtuutettu initiative-päätös.
- **Oletus:** todentamaton lähtökohta, jolla on omistaja ja review-trigger.
- **Hypoteesi:** ehdotettu syy–seuraus-parannus, jolla on baseline ja mitattava odotus.
- **Löydös:** review’n, validoinnin tai tutkimuksen evidenssiin perustuva havainto.
- **Avoin kysymys:** puuttuva tieto, joka voi johtaa `needs_input`-tilaan eikä sitä saa keksiä.

### Evidenssitasot

1. Runtime UI näyttää ajonaikaisen canonical-tilan, ei pitkäikäistä arkkitehtuuriselitystä.
2. SQLite säilyttää tarkat Run/task/outcome/State/event-faktat, ei dokumenttien kopioita.
3. Initiative EVIDENCE indeksoi hyväksymiseen tarvittavan rajatun evidenssin ja nimeää komennot/polut/rajoitukset.
4. TRACEABILITY yhdistää Goal/REQ/QS:n päätökseen, rakenteeseen, testiin ja evidenssiin.
5. STATUS ja METHOD-HEALTH muuttuvat vain uuden evidenssin tai päätöksen perusteella.

Lokit tukevat diagnoosia, mutta vakaat ID:t ja canonical store -faktat tukevat hyväksymistä. Salaisuuksia, provider credentialeja tai hidden reasoning -sisältöä ei kopioida arkkitehtuuridokumentteihin.

## UI:n totuusperiaate

- `DESIGN.md` omistaa värit, typografian, spacingin, radius-säännöt ja visuaalisen periaatteen.
- Aktiiviset authoring-projektiot ovat canonical `graph | graph_node | action_node`: Graph Engineering näyttää Capability Graph / global 5×5 Decision Modelin; Graph Node näyttää Action Nodes / local N×N Decision Modelin; Action Node näyttää protected Work/Validation-flow'n.
- Job-flow ei renderöi Next job -targetia eikä Graph Node Orchestrator -junctionia. Vain Work/Validation avaavat inspectorin; kaikki muut merkit ovat ei-interaktiivisia eivätkä ole candidate-, topology- tai runtime-kirjoituksia.
- Capability/Jobs-kortti näyttää vain oman scopen authoroidun sopimuksen. Layout tai valinta ei omista topologiaa eikä foreign-scope-nodea näytetä.
- Run-projektio näyttää Graph- tai GraphNode-Rootin immutable snapshotin ja canonical positionin ilman standalone Action Node Runia.
- Position, role, profile, attempt, revision, acceptance, retry/escalate ja finalization tulevat snapshotista ja canonical persistence -projektiosta.
- Visuaalinen card status tai Job-flow artwork/yhteys auttaa lukemista mutta ei muodosta uutta runtime-tilaa.
- Draft policy UI erottaa Configure-owned Capability/Reward Decision Modelin Run-owned Decision State/acceptance/policy evidence/Execution Graphista. Compiled policy -projektio ei ole tallennettu Current Plan eikä dispatch authority UI:ssa.
- Prosenttia, ETA:a, elapsed-telemetriaa tai provider-tekstistä pääteltyä statusta ei esitetä, ellei tuleva kanoninen sopimus ja ADR sitä erikseen määritä.
- Target UI käyttää DESIGN target appendixia: Direction, Use Cases, ordered Environment/State/Action, Validation-led flow, Run Gate, Feedback Box, Critic review, exact refinement approval ja Product Snapshot. Se ei näytä freeform graph topologyä tai reward/policy-matriisia. Phaseissa 02–08 tämä projektio pysyy `/vnext`-reitillä eikä muuta aktiivista v19-projektiota.

## Versiointi ja yhteensopivuus

- `.ballet/project.json` käyttää strict-v19-skeemaa: Graph omistaa yhteisen Staten, acceptance-ledgerin, global `reward_mdp_v4`:n ja 1–40 GraphNodea; GraphNode omistaa outcomet/effectit, optional obligation-bindingin, local `reward_mdp_v4`:n ja ActionNodet.
- V19-toteutus ei säilytä v18/v3/v6/v11/v14-readeria, reittialiaksia, dual-writeä tai silent compatibilityä.
- Shared API/TypeScript-sopimuksen semanttinen muutos vaatii toteutuksen ja kuluttajien koordinoidun päivityksen sekä testit.
- SQLite schema v15 käyttää GraphNode-/ActionNode-/Work/Validation-invocationeja sekä append-only scope-tagged policy decision/observation/acceptance-evidenssiä. Vanhaa tietokantaa ei migroida automaattisesti, vaan käynnistys antaa täsmällisen remediation-ohjeen ja epäonnistuu suljetusti.
- Arc42/frontmatter stable ID säilyy sisältöpäivityksessä; `version` kasvaa vain semanttisesta dokumenttimuutoksesta.
- Hyväksytty ADR ei muutu hiljaisesti; uusi päätös supersedoi sen eksplisiittisesti.
- Target käyttää strict Project Config v20 / Snapshot v13 / Task+role v10 / composition v11 / ExecutionSpec v12 / SQLite v16 / Feedback-Critic-Refinement v1 -matriisia. Phaseissa 02–08 se ei lue tai kirjoita v19/v15-dataa; phase 09 poistaa old/vNext-pinnat yhtä aikaa ilman migraatiota, readeria, aliasia tai dual-writeä.

## Kanoniset lähteet

ADR:t omistavat päätökset, `DESIGN.md` UI-järjestelmän, source/shared schemas suoritettavan käyttäytymisen ja tässä linkitetyt arc42-lähteet pitkäikäisen selityksen.

## Relevantit päätökset

`adr-002`, `adr-005`–`adr-008`, `adr-011`–`adr-016`, `adr-020`, `adr-025`, aktiivinen `adr-033` ja target `adr-034`. ADR-023:n sekä ADR-026–032:n supersedoidut osat säilyvät vain historiallisena audit trailina.

## Evidenssi

Konseptit mapittuvat BB-, RT-, DEP- ja QS-tunnisteisiin. TRACEABILITY nimeää testit ja evidenssit; tämän dokumentaatiotyön conformance review tarkistaa, ettei kuvaus väitä runtime-sopimuksen muutosta.

CON-014:n toteutusevidenssi on TEST-027/EVID-027-ketjussa; tuotantokaltainen Reward-MDP-pilotti pysyy avoimena.

CON-015:n target-evidenssi on TEST-028–TEST-032/EVID-028–EVID-032-ketjussa ja vielä pending.

## Avoimet kysymykset

- Uutta konseptia ei nosteta tänne ilman usean rakennusosan vaikutusta tai priorisoitua laatuskenaariota.
- Operatiivisen telemetry-retentionin tarve arvioidaan ennen tuotantokäyttöä erillään arkkitehtuuridokumentaation säilytyksestä.

## Seuraava katselmointiperuste

Katselmoi osio, kun evaluation löytää toistuvan ristiriidan rakennusosien välillä tai prioriteetti-1-QS vailla yhteistä ratkaisua.
