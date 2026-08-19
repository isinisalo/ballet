---
id: adr-018
title: Graph Engineering, Loop Engineering ja Orchestrator-ohjattu v11-graafi
status: accepted
createdAt: '2026-08-19T00:00:00.000Z'
updatedAt: '2026-08-19T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - graph-engineering
  - loop-engineering
  - orchestrator
version: 1
---

# Graph Engineering, Loop Engineering ja Orchestrator-ohjattu v11-graafi

## Konteksti

Nykyinen toteutettu baseline on strict project configuration v10, jossa Loop Engineer tarjoaa Context-, composition- ja selected-Loop detail -projektiot. `ProjectLoopEdge.kind = flow` sallii enintään yhden lähtevän flow-edgen, jonka `LoopCompletionEngine.followFlow` seuraa automaattisesti. Repair kulkee jo `LoopOrchestrator`in, immutable Root Run snapshotin, allowlistin ja durable call framen kautta.

`goal-012` hyväksyy uuden WHAT/WHY-rajan: projektitason kokonaisuus authoroidaan Graph Engineeringissä ja yhden Loopin sisäinen Work/Validation-rakenne Loop Engineeringissä. UI ei saa väittää Orchestrator-ohjattua graafia, jos runtime seuraa flow-edgeä edelleen automaattisesti. Muutos on siksi strict-v11-domainin, snapshotin, persistenssin, runtimen, API:n, UI:n ja testien yhteinen hard cut, ei visuaalinen uudelleennimeäminen.

Tämä ADR on hyväksytty käyttäjän 2026-08-19 antamalla eksplisiittisellä päätösvaltuutuksella. Tässä vaiheessa hyväksytään päätös ja muutosraja; tuotantokoodi, runtime, schema, API, `.ballet/project.json` ja frontend säilyvät v10-baselinessa.

## Päätösajurit

- Graph Engineeringin on kuvattava samaa project-global route-policya, jonka runtime todella validoi ja suorittaa.
- Loopien on oltava toisistaan riippumattomia: peer-Loopin tai targetin nimeäminen kuuluu vain graafiin.
- Flow- ja repair-reittien on käytettävä samaa immutable snapshot-, capability-, allowlist- ja ihmisrajaa.
- Repairin toimiva State revision-, retry-, depth-, call frame- ja continuation-semanttiikka on säilytettävä.
- Pre-release-tuote ei säilytä v10-compatibility-lukupolkua, dual-writeä tai muuta legacy-painolastia.
- Platform saa toteuttaa vain geneeriset graph-, capability-, orchestration-, snapshot-, State- ja continuation-primitiveet; project-workflow säilyy project-local-datana.

## WHAT/WHY: hyväksytty tuoteraja

`goal-012` omistaa seuraavat WHAT/WHY-päätökset:

- authoring-näkymiä on täsmälleen kaksi: **Graph Engineering** ja **Loop Engineering**;
- Graph Engineering on oletusnäkymä ja project-global authoring-projektio;
- Loop Engineering näyttää vain valitun Loopin sisäisen Work/Validation-komposition;
- yksi `ProjectLoop` projisoidaan Graph Engineeringissä yhdeksi `LoopNode`-näkymänodoksi; `LoopNode` ei ole uusi runtime-entiteetti;
- `ProjectWorkLoopNode` säilyy Loop Engineeringin sisäisenä kompositiona;
- `LoopOrchestrator` näkyy Graph Engineeringissä omana control-nodena eikä se ole `ProjectLoop`;
- Context poistuu, eikä käyttäjälle jää Level 0 / Level 1 / Level 2 -käsitemallia;
- graph omistaa Looppien välisen koostamisen ja sallitut flow- sekä repair-route-candidatet;
- Loop tai sen task, instruction, skill, State-contract, outcome tai module package ei nimeä peer Loopia, seuraavaa Loopia, repair-targetia tai continuationia; ja
- release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen.

## HOW: arkkitehtuuripäätökset

### Kaksi tyypitettyä projektiota ja reittiä

Authoring-projektion typed union on `graph | loop`. Graph Engineering on default, myös paljaalla `/automation/loops`-reitillä. Tulevat kanoniset reitit ovat:

```text
/automation/loops?view=graph
/automation/loops?view=loop&id=<loop-id>
```

Numeric `level` -reitit, `context | composition | detail` -frontend-malli, compatibility-aliakset ja silent route defaultit poistetaan v11-toteutusvaiheessa. Virheellinen `view` tai puuttuva `id` Loop Engineeringissä ei valitse ensimmäistä Loopia hiljaa, vaan tuottaa eksplisiittisen validointi-/not-found-tilan.

### Graph ja UI-projektiot

Graph on `ProjectAutomationConfig`-aggregaatin project-global projektio, ei erillinen client-owned topology state eikä uusi runtime-entiteetti. Se sisältää kaikki `ProjectLoop`it, Orchestrator-konfiguraation ja persisted route-policyn.

Graph Engineering:

- näyttää täsmälleen yhden `LoopNode`-projektion jokaista `ProjectLoop`ia kohti;
- näyttää yhden `LoopOrchestrator`-control-projektion;
- ei näytä `ProjectWorkLoopNode`-, Work- tai Validation-nodeja;
- projisoi control-edget persisted route-policysta ja, Run-kontekstissa, canonical runtime-evidenssistä; ja
- ei tallenna layoutia, valintaa, piirrettyä edgeä tai muuta client statea uutena topologiatotuutena.

Loop Engineering säilyttää selected-Loop-only canvasin, `ProjectWorkLoopNode`-komposition, Loopin sisäiset `ProjectNodeEdge`-yhteydet ja terminal targetit. Se ei näytä project-global routeja eikä Orchestrator-nodea.

Normaalissa tilassa Orchestrator käyttää design-tokenien primary/secondary/loop-flow/tertiary-semanttiikkaa. Error-väri on varattu blocking- tai failed-tilalle, ei Orchestratorin brändiväriksi.

### Strict project configuration v11

Project configuration muuttuu strict v11:ksi yhdessä koordinoidussa hard cutissa. V11:n ylätason vastuut ovat `version`, `executionProfiles`, `orchestrator`, `graph` ja `loops`. `graph` omistaa project-global flow- ja repair-allowlistat; v10:n top-level `loopEdges` ei jää rinnakkaiseksi totuudeksi.

Jokaisella `ProjectLoop`illa on first-class, geneerinen capability metadata. V11:n vähimmäissopimus erottaa Loopin tarjoamat ja tarvitsemat capabilityt vakaina, koneellisesti validoitavina tunnisteina. Jokainen graph route candidate nimeää source- ja target-Loopin, kindin `flow | repair`, valintaan vaaditun capabilityn sekä kuvauksen. Parseri validoi route-candidaten targetin capability-metadatan kanssa ennen kuin config voidaan snapshotata.

Tarkka shared TypeScript/Zod-sopimus toteutetaan seuraavassa vaiheessa tämän semantiikan mukaisesti. Se on strict: unknown kentät, duplikaatit, puuttuvat capabilityt, tuntemattomat source/target-ID:t ja ristiriitaiset route-candidatet hylätään fail-closed.

V11 ei sisällä v10-parseria, compatibility-readeria, automaattista v10→v11-konversiota, silent defaultteja, fallback-projektiota, dual-writeä eikä rinnakkaista `loopEdges`-mallia. Repository-owned config, fixturet, module package -materialisointi ja testit muutetaan eksplisiittisesti samassa toteutusketjussa. V10-historiaa tai historiallisia dokumentteja ei kirjoiteta uudelleen.

### Immutable Root Run snapshot ja entry Loop

Root Run voidaan V1:ssä käynnistää eksplisiittisesti valitusta entry Loopista. Planner snapshottaa valitusta entrystä graph route candidateja pitkin saavutettavan Loop-, capability-, route-, Orchestrator-, profile- ja resource-closuren ennen ensimmäistä Node Runia. Käynnissä oleva Run ei lue checkoutin myöhempää graph- tai capability-muutosta.

Jokainen cross-Loop-reitti validoidaan saman Root Runin immutable snapshotin allowlistia ja capability metadataa vasten. Provider tai client ei voi laajentaa snapshotia, myöntää permissionia, keksiä routea tai vaihtaa targetia fallbackilla.

### Flow-dispatch

Kun top-level Loop invocation päättyy `completed`:

1. nolla sallittua outgoing flow candidatea päättää Root Runin `completed`-tilaan;
2. yksi tai useampi outgoing flow candidate kulkee `LoopOrchestrator`-dispatchin kautta;
3. dispatch hyväksyy vain snapshotin graph-allowlistiin kuuluvan ja capability-yhteensopivan candidaten;
4. yksi yksiselitteinen candidate voidaan valita deterministisesti ilman vapaata provider-arvausta;
5. usea yhtä perusteltu candidate tai ihmisvaltuutusta vaativa route tuottaa `needs_input`; ja
6. flow aloittaa uuden Loop invocationin samalla Root-owned Statella mutta ei luo repair-framea tai return-continuationia.

ADR-015:n nykyinen automaattinen yhden flow-edgen `followFlow`-semantiikka poistetaan v11-toteutuksessa. Flow ei saa olla piilotettu suora hyppy, jota Graph Engineeringin Orchestrator-control ei vastaa.

### Repair-dispatch ja paluu

Validationin `ORCHESTRATOR_REPAIR` ilmaisee edelleen requested capabilityn tai outcomen eikä target Loop ID:tä. Runtime muodostaa candidatelistan snapshotin `repair`-allowlistasta, rajaa sen capabilityllä ja antaa Orchestratorin valita vain tästä joukosta.

Yksiselitteinen repair-route luo durable call framen. Repair-target käyttää samaa Root-owned State revision -ketjua, ja targetin `completed` palaa frameen tallennettuun callerin samaan Validation Nodeen. Repair-targetin oma flow ei ohita paluuta. Ambiguity, puuttuva candidate tai puuttuva ihmisvaltuutus tuottaa `needs_input`; permission escalation ei myönnä oikeutta automaattisesti.

ADR-015:n State revision-, local retry-, repair attempt-, depth-, transition limit-, LIFO-frame-, cancellation- ja recovery-periaatteet säilyvät.

### Riippumattomuus ja project/platform-raja

Peer-Loopin tai targetin vakaa ID saa esiintyä route-policyn source/target-kentissä ja canonical runtime-evidenssissä. Se ei saa esiintyä reititysohjeena `ProjectLoop`in sisäisessä taskissa, instructionissa, skillissä, State-contractissa, outcome-sopimuksessa tai yhden Loopin module packagessa.

Loopit ja package voivat nimetä vain omat capabilityt, input/output-sopimukset ja yhden Loopin sisäisen rakenteen. Project-local graph koostaa ne. Platform-koodi toteuttaa geneeriset parseri-, capability-, snapshot-, dispatch-, State-, frame- ja evidence-primitiveet eikä tunne arc42-, UI-, implementation-, release- tai deploy-Loopien nimiä.

## Supersession-raja

Tämä ADR ei kirjoita historiallisia Goal- tai ADR-tiedostoja uudelleen eikä poista niitä.

| Aiempi päätös | Osittain korvautuva osa | Säilyvä osa |
| --- | --- | --- |
| `goal-011` | Context / Level 0, numeric level -käyttäjämalli ja vanha Level 1 composition -tavoite korvautuvat `goal-012`:n kahdella nimetyllä näkymällä. | Black box / white box -erottelu, selected-Loop-only sisäinen editori ja eri edge-omistajuuksien erillään pitäminen. |
| `adr-017` | `context | composition | detail`, numeric `level` -reitit, Context-projektio ja Level 1 composition -projektion nimi/rakenne korvautuvat Graph Engineeringillä. | `ProjectLoop` on UI-projektio ilman uutta runtime-entiteettiä; selected-Loop-only sisäinen projektio ja `ProjectNodeEdge`-omistajuus säilyvät Loop Engineeringissä. |
| `adr-015` | Automaattinen enintään yhden flow-edgen `followFlow` korvautuu Orchestrator-dispatchilla, multi-candidate-allowlistilla ja `needs_input`-ambiguiteetilla. | Work/Validation, Root-owned State, revisionit, local retry, repair request, call frame, samaan Validationiin palaava continuation, depth/attempt/transition-rajat, cancellation ja recovery. |

## Seuraukset

- Domain, strict schema, snapshot, persistence, runtime, API, UI, module materialization ja testit tarvitsevat koordinoidun v11-muutoksen.
- Graph Engineering voi näyttää todellisen control-noden ja persisted route-policyn ilman fake-orchestrationia.
- Looppien riippumattomuus kasvaa, koska cross-Loop-tieto keskitetään graphiin ja snapshot-evidenssiin.
- V11 hard cut kasvattaa yhden muutoksen laajuutta, mutta poistaa pysyvän v10/v11-compatibility-matriisin.
- Nykyinen v10 Context/Level 1/Level 2 -UI ja automaattinen flow pysyvät toteutettuna faktana, kunnes initiative on implementoitu ja todennettu; tätä ADR:ää ei saa käyttää väittämään niitä jo poistetuiksi.

## Hylätyt vaihtoehdot

### Vain UI:n uudelleennimeäminen

Hylätty, koska Orchestrator-control ja multi-candidate flow olisivat silloin visuaalinen väite ilman runtime-vastinetta.

### V10- ja v11-reader rinnakkain

Hylätty, koska compatibility-reader, alias-reitit, silent defaultit ja dual-write jättäisivät legacy-painolastin sekä kaksinkertaisen testimatriisin.

### Target Loop Validationissa tai taskissa

Hylätty, koska se kytkee itsenäisen Loopin project-topologiaan, ohittaa graph-allowlistin ja tekee module reuse -rajasta epärehellisen.

### Flow suoraan source Loopista

Hylätty, koska direct `followFlow` ei voi käsitellä useaa candidatea, capability-valintaa tai ihmisvaltuutusta samalla Orchestrator-rajalla kuin repair.

## Evidenssi ja review trigger

Päätöksen lähteet ovat `goal-012`, ADR-015, ADR-017, nykyinen strict-v10-domain/runtime/UI sekä initiative `graph-and-loop-engineering`. Toteutusevidenssi on vielä pending, eikä päätös yksin muuta nykyistä schemaa tai käyttäytymistä.

Päätös arvioidaan uudelleen ennen nested Loop -runtime-entiteettiä, graphin irrottamista `ProjectAutomationConfig`-aggregaatista, v10 compatibility -polun lisäämistä tai sellaista route DSL:ää, joka voisi kovakoodata project-workflow'n platformiin.
