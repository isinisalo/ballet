---
id: arc42-section-10
title: Laatuvaatimukset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-19'
version: 7
tags:
  - arc42
  - quality
  - scenarios
arc42Section: 10
---

# 10. Laatuvaatimukset

## Tarkoitus

Tämä osio määrittää arkkitehtuurin suunnitteluun, hyväksymiseen ja evaluationiin käytettävät mitattavat laatuskenaariot. Goal omistaa laatuaikeen; skenaario määrittää havaittavan ärsykkeen, ympäristön, vasteen ja onnistumisen rajan.

## Tila

QS-001–QS-010 sekä niiden prioriteetit perustuvat hyväksyttyihin Goaleihin ja `goal-009`:n valtuutukseen. Käyttäjä hyväksyi 2026-08-17 QS-011–QS-013:n prioriteetin 1. `goal-012`:n acceptance intent ja käyttäjän 2026-08-19 päätösvaltuutus tekevät QS-014:stä prioriteetin 1 v11-acceptance-rajan. Evidenssistatus on erillinen: pending implementation tai verification ei ole onnistumisväite.

## Laatupuu

```mermaid
flowchart TD
  quality["Balletin laatu"] --> safety["Turvallisuus ja auktorisointi"]
  quality --> integrity["Determinismi ja eheys"]
  quality --> recovery["Palautettavuus ja observability"]
  quality --> usability["Käytettävyys ja ylläpidettävyys"]
  safety --> q1["QS-001 paikallinen raja"]
  safety --> q4["QS-004 worktree ja network"]
  safety --> q7["QS-007 external write"]
  integrity --> q2["QS-002 resurssit"]
  integrity --> q3["QS-003 repair"]
  integrity --> q11["QS-011 composition"]
  recovery --> q6["QS-006 evaluation"]
  recovery --> q12["QS-012 restart ja cancel"]
  usability --> q5["QS-005 arkkitehtuuritotuus"]
  usability --> q8["QS-008 learning"]
  usability --> q9["QS-009 module trust"]
  usability --> q10["QS-010 authoring"]
  usability --> q13["QS-013 Run projection"]
  integrity --> q14["QS-014 Graph/Loop v11"]
```

Laatupuu ei muuta prioriteettia: safety-, integrity- ja recovery-invariantit voivat estää toiminnon, vaikka käytettävyys kärsisi. UI:n ymmärrettävyys ei oikeuta keksittyä runtime-telemetriaa.

## Laatuskenaariot

<!-- quality-scenarios:start -->
| ID | Source | Stimulus | Environment | Affected artifact | Expected response | Measurable response criterion | Priority | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QS-001 | goal-001, goal-007 | Operaattori käynnistää ja käyttää Balletia commitoidusta checkoutista. | Tuettu macOS-host ja paikallinen selain. | BB-001, BB-002, DEP-001 | Palvele vain checkout-local-komentokeskusta ja näytä täsmällinen operatiivinen tila. | API bindaa vain loopbackiin; toisella checkoutilla on eri service identity ja runtime state; automatisoidut lifecycle/API-tarkistukset läpäisevät. | 1 | EVID-001 | verified |
| QS-002 | goal-002, goal-003 | Root Run pyydetään muuttuneilla, puuttuvilla tai virheellisillä project-resursseilla. | Preflight ennen yhtäkään provider-tehtävää. | BB-003, BB-004, CON-003 | Snapshottaa yksi deterministinen validi resource closure tai failaa suljetusti. | Invalidi/duplikaatti/puuttuva profile, instruction tai skill tuottaa vähintään yhden tarkan issuen ja jonottaa 0 provider-tehtävää; samat lähteet tuottavat samat resource hashit. | 1 | EVID-002 | verified |
| QS-003 | goal-004, goal-006 | Validation pyytää ulkoista repairia. | Active Root Run, jossa on nolla, yksi tai useita capability-candidateja. | BB-004, BB-005, RT-003 | Reititä vain capabilityn ja source allowlistin perusteella ja palaa samaan Validationiin. | Target kuuluu allowlistiin; continuation on runtime-owned; ambiguous/puuttuva target tuottaa `needs_input`; repair depth-, attempt- ja transition-rajat ylittyvät 0 kertaa. | 1 | EVID-003 | verified |
| QS-004 | goal-005 | Normaali architecture- tai implementation-Node suoritetaan. | Root Run -worktree ilman eksplisiittistä research/release-tarvetta. | BB-004, BB-006, DEP-002, CON-001 | Pidä verkko pois päältä ja kirjoitukset Run-worktreessä. | 100 % non-research/non-release-konfiguroiduista Nodeista käyttää network-off-profiilia; permission-policy- ja worktree-testit läpäisevät; active checkout -kirjoituksia 0. | 1 | EVID-004 | verified |
| QS-005 | goal-009 | Project architecture- tai method-artefakti muuttuu. | Repository-validointi ennen handoffia. | BB-003, BB-008, CON-006 | Säilytä yksi ratkaistava source of truth vakailla ID:illä. | `npm run validate:arc42` raportoi 0 puuttuvaa required docia, duplicate ID:tä, broken local linkkiä, unresolved tracea tai resource referenceä. | 1 | EVID-005 | verified |
| QS-006 | goal-009 | Initiative saavuttaa architecture evaluation -vaiheen. | Evaluate Loop rajatun toteutuksen jälkeen. | BB-004, BB-008, RT-003, CON-006 | Vertaa toteutusta mitattaviin QS-kriteereihin ja kirjaa evidenssi, riski ja drift. | Jokainen REVIEW traceaa 100 % in-scope priority-1-QS:istä testiin/monitoriin ja evidenssistatukseen; puuttuva näyttö kirjataan findingiksi tai repair requestiksi, ei accepted-tilaksi. | 1 | EVID-006 | pending pilot |
| QS-007 | goal-005, goal-008, goal-009 | Release, deploy tai rollback pyydetään. | Release-validation Loop network-capabilitylla. | BB-006, BB-007, RT-005, DEP-003, CON-001 | Pysähdy täsmälliseen ihmisvaltuutukseen ennen jokaista hyväksymätöntä ulkoista toimintoa. | Ennen kirjattua valtuutusta suoritetaan 0 external write -komentoa; automatic behavior sisältää 0 merge/push-toimintoa; kaikki yritetyt komennot nimetään evidenssissä. | 1 | EVID-007 | policy verified; execution pending |
| QS-008 | goal-009 | Scheduled learning löytää mahdollisen teknologia- tai menetelmäparannuksen. | Maanantain research-ajo primary-source-network-oikeudella. | BB-006, BB-008, RT-004, CON-006 | Säilytä vain materiaalinen evidenssi ja reititä muutos oikeaan hyväksyntärajaan. | Jokaisella säilytetyllä findingillä on lähde, vaikutus, QS/RISK/ADR/BB-viite ja odotettu metriikka; ei materiaalista findingiä → 0 semanttista dokumenttimuutosta. | 2 | EVID-008 | pending pilot |
| QS-009 | goal-010 | Operaattori importoi, asentaa, exportoi tai poistaa Loop modulen myös injected failure-, conflict- tai active Run -tilanteessa. | Tyhjä tai konfiguroitu projekti loopback API/UI:n kautta. | BB-001–BB-003, BB-009, RT-006, RT-007, CON-007 | Validoi/hashaa epäluotettu sisältö, näytä täsmällinen plan, materialisoi deterministisesti ja säilytä project/runtime-rajat. | Kaikki package/service/API/UI/release smoke -skenaariot läpäisevät; stale/incompatible/active-operaatio kirjoittaa 0 config-muutosta; injected config failure jättää 0 uutta referoitua resurssia; removal poistaa 0 shared-resurssia. | 1 | EVID-009 | implementation verified; full gate pending |
| QS-010 | goal-011 | Operaattori navigoi Context-, composition- ja selected-Loop detail -tasot, muokkaa kumpaakin Edge-lajia tai asentaa starter-modulen. | Paikallinen selain 1440×900 ja 390×844 configured/cyclic/empty-fixtureillä. | BB-001, BB-009, RT-006, CON-005 | Säilytä yksi hierarkia, deterministiset datarajat, keyboard access ja authoritative post-install state. | Route/projection/UI/module-testit läpäisevät; canvas sisältää 0 foreign-level node/Edge-kind-lajia; Space valitsee ja Enter avaa Level 1 Loopin; molemmat viewportit näyttävät kolme tasoa ilman clipped core actionia tai horizontal page overflow’ta. | 1 | EVID-010 | historical verified; superseded by QS-014 |
| QS-011 | goal-003 | Sama immutable Root Run -snapshot ja sama `TaskEnvelope` koostetaan toistuvasti, minkä lisäksi yksi required resource rikotaan. | Provider-task preflight Codex- ja Copilot-adapterirajojen edessä. | BB-003, BB-004, BB-006, RT-008, CON-003 | Tuota validille inputille tavutasolla sama provider-payload ja estä invalidi composition ilman fallbackia. | Validin inputin prompt-bytes, composition hash, resolved resource -järjestys ja output schema ovat 100 % identtiset jokaisessa toistossa ja molempien adapterien inputissa; invalidi composition jonottaa 0 taskia ja provider/model/profile-fallbackien määrä on 0. | 1 | EVID-011 | verified |
| QS-012 | goal-006 | Palvelu restarttaa, kun task on queued tai running, ja cancellation commitoidaan ennen myöhäistä provider-payloadia. | Checkout-local SQLite, queue reconciliation ja active Root Run. | BB-004–BB-006, RT-009, DEP-001, DEP-002, CON-002 | Säilytä queued-työ, merkitse running-työ keskeytyneeksi ilman replayta ja estä duplicate/post-cancel-vaikutus. | Restartin jälkeen 100 % queued-tehtävistä säilyy; 100 % aiemmin running-tehtävistä on täsmälleen kerran `interrupted` eikä automaattista replayta synny; commitoituja State-revisioita/control-flow-eventtejä monistuu 0; cancellationin jälkeinen payload luo 0 state/outcome/continuation-muutosta. | 1 | EVID-012 | verified |
| QS-013 | goal-007 | Operaattori tarkastaa aktiivista, repairissa olevaa, palannutta ja finalisoitua Runia sekä vastaa Human Nodeen. | Run mission control paikallisessa selaimessa immutable snapshotin ja canonical persistencen päällä. | BB-001, BB-002, BB-005, RT-010, CON-005 | Johda position, role, profile, attempt, revision, repair, return ja finalization vain snapshotista/read storesta; älä keksi telemetriaa. | View-model/panel-testit osoittavat 100 % nimetyistä kentistä canonical DTO -lähteeseen; provider-tekstistä johdettuja state-kenttiä on 0; UI näyttää 0 keksittyä prosenttia, ETA:a tai elapsed-arvoa; repair/return/human/finalization-fixtureiden expected projectionit läpäisevät. | 1 | EVID-013 | verified |
| QS-014 | goal-012 | Operaattori authoroi project-global graphin tai avaa yhden Loopin, ja runtime kohtaa nolla, yhden tai usean flow/repair route candidaten. | Strict-v11 config, immutable Root Run snapshot ja paikallinen selain desktop/narrow-viewportissa. | BB-001, BB-003–BB-006, BB-009, RT-011, CON-002, CON-005 | Näytä täsmälleen Graph Engineering / Loop Engineering, validoi jokainen cross-Loop-valinta graph-allowlistilla ja capabilityllä sekä pysähdy ambiguityssa tai ihmisvaltuutuksessa `needs_input`-tilaan. | V11 parseri hylkää 100 % v10-, unknown-, silent-default- ja dual-write-fixtureistä; Context/numeric route/legacy-mallin aktiivisia polkuja on 0; Graph-projektiossa on täsmälleen yksi LoopNode per ProjectLoop ja yksi Orchestrator-control sekä 0 sisäistä Work/Validation-nodea; Loop-projektiossa on 0 project-global route/control-nodea; runtime-testit osoittavat zero-flow completionin, kaikki flow/repair-dispatchit Orchestratorin kautta, capability/allowlist-rejectionin, ambiguity/permission `needs_input`-tilan, repair-returnin samaan Validationiin ja flow framejen määrän 0. | 1 | EVID-014 | routing/Loop UI passed GLE-EVID-005/007; Orchestrator-control/human acceptance pending |
<!-- quality-scenarios:end -->

## Priorisoinnin tulkinta

- **Prioriteetti 1:** release/acceptance estyy, jos kriteeriä ei ole osoitettu tai puuttumisen vaikutusta ei ole eksplisiittisesti hyväksytty.
- **Prioriteetti 2:** skenaario vaikuttaa menetelmän kehitykseen mutta voi odottaa oikeaa triggeriä; pending-evidenssi ei oikeuta semanttista muutosta.
- Testin läpäisy todentaa nimetyn ympäristön. Se ei yksin todista tuotantokaltaista operointia, jos skenaario vaatii pilotin tai ulkoisen valtuutuksen.

## Kanoniset lähteet

Goalit omistavat quality intention. Tämä osio omistaa mitattavat skenaariot; [TRACEABILITY](TRACEABILITY.md) omistaa niiden suhteet päätöksiin, rakenteisiin, testeihin ja evidenssiin.

## Relevantit päätökset

`adr-005`, `adr-006`, `adr-007`, `adr-008`, `adr-011`, `adr-012`, `adr-013`, `adr-015`, `adr-016`, `adr-017` ja `adr-018`.

## Evidenssi

EVID-001–EVID-014 ratkaistaan TRACEABILITYssa. EVID-011–EVID-013 on merkitty verifiediksi 2026-08-17 ajettujen nimettyjen testien ja conformance-katselmoinnin jälkeen. EVID-014 on pending, kunnes koko strict-v11-initiative on toteutettu ja arvioitu. Pending- tai failed-evidenssiä ei käsitellä onnistumisena.

## Avoimet kysymykset

- Pilot-specific performance-, latency- tai usability-threshold vaatii ihmisen hyväksynnän initiative-BRIEFissä ennen priorisointia.
- QS-012:n paikalliset fault-injection-testit tulee myöhemmin täydentää operatiivisella restart-evidenssillä ennen production-readiness-väitettä.

## Seuraava katselmointiperuste

Katselmoi osio, kun Goal muuttuu, skenaariota ei voi mitata tai evaluation osoittaa, ettei kriteeri erota onnistumista epäonnistumisesta.
