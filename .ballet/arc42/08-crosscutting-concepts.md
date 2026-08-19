---
id: arc42-section-08
title: Poikkileikkaavat konseptit
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-19'
version: 7
tags:
  - arc42
  - concepts
arc42Section: 8
---

# 8. Poikkileikkaavat konseptit

## Tarkoitus

Tämä osio selittää useaan rakennusosaan vaikuttavat, laatutavoitteista johdetut ratkaisuperiaatteet. Se ei ole kaikkien ohjelmointikäytäntöjen katalogi. Konsepti kuuluu tänne, kun sen rikkominen muuttaisi usean BB:n turvallisuutta, determinismiä, palautumista, evidenssiä tai operaattorin tulkintaa.

## Tila

CON-001–CON-007 ovat hyväksytyn arkkitehtuurin yhteisiä konsepteja. QS-014 / ADR-018:n strict-v11 graph/capability-raja on toteutettu configissa, shared contracteissa, snapshotissa, module materialisoinnissa, persisted Orchestrator-dispatchissa ja Graph/Loop-authoring-reiteissä muuttamatta concept-ID:itä; Graphin Orchestrator-control-node ja ihmisacceptance ovat pending.

## Konseptikartta

| ID | Konsepti | Soveltuu | QS | Toteutusankkurit |
| --- | --- | --- | --- | --- |
| CON-001 | Least-authority local execution: loopback API, eksplisiittinen Origin-politiikka, worktree-only Node-kirjoitukset, network-off-oletus ja ihmisen external-write-valtuutus. | BB-002, BB-004, BB-006, BB-007 | QS-001, QS-004, QS-007 | ADR-006, ADR-008, workspace permission policy |
| CON-002 | Durable canonical control: strict role outcomes, atomiset State patchit, append-only revisionit, bounded retry, repair-frame ja runtime-owned continuation. | BB-004–BB-006 | QS-003, QS-012 | ADR-015, runtime/state/queue-storet |
| CON-003 | Deterministinen execution composition: System → primary → vakaasti järjestetyt skillit → `TaskEnvelope` → role/output schema, kaikki snapshotattuna ja hashattuna. | BB-003, BB-004, BB-006 | QS-002, QS-004, QS-011 | ADR-012, ADR-013, `ExecutionComposition` |
| CON-004 | Siirrettävät project resources: repository-polut omistavat configin, dokumentit, instructionit ja skillit; machine state jää `.git/ballet`-hakemistoon. | BB-003, BB-008, BB-009 | QS-002, QS-005, QS-009 | ADR-002, ADR-014, ADR-016, resource catalog |
| CON-005 | Cyber-industrial operator UI ja canonical projection: dense, accessible, token-driven React/Tailwind/shadcn-pinnat näyttävät vain nimetyn runtime/project-totuuden. | BB-001, BB-002, BB-005 | QS-001, QS-010, QS-013, QS-014 | [DESIGN.md](../../DESIGN.md), `engineeringProjections.ts`, `loopRunViewModel.ts` |
| CON-006 | Evidenssipohjainen arc42 Method: stable ID:t, väitetyypit, initiative handoff, traceability, conformance ja mitattu method health. | BB-003–BB-005, BB-008 | QS-005, QS-006, QS-008 | goal-009, ADR-011, project-local arc42-resurssit |
| CON-007 | Copy-to-project module trust: strict rajattu JSON, canonical hash, deterministic namespace, compatible profile slots, revalidated plan, config-last commit ja content-derived provenance. | BB-001–BB-003, BB-009 | QS-002, QS-004, QS-009 | ADR-016, Loop module schemas/service/tests |

## Turvallisuus ja auktorisointi

Turvallisuus muodostuu useasta erillisestä portista:

1. **Checkout identity:** palvelu palvelee yhtä ratkaistua checkoutia.
2. **Request validation:** shared schema ja HTTP boundary estävät malformed-inputin ennen käyttötapausta.
3. **Snapshot/preflight:** target, reachable graph, resource closure, profiili ja oikeudet validoidaan ennen queuea.
4. **Workspace policy:** providerin kirjoitusalue on Root Run -worktree ja verkko riippuu profiilista.
5. **Outcome validation:** provider-output ei ole canonical ennen role/output-skeemaa.
6. **External effect:** merge, push, release, deploy ja rollback vaativat täsmällisen ihmisvaltuutuksen, vaikka muut portit olisivat läpäisty.

Authentication-palvelua ei lisätä loopback-arkkitehtuuriin implisiittisesti. Tämä ei tee kaikesta paikallisesta inputista luotettua: Origin, checkout, schema, package trust ja provider output validoidaan omissa rajoissaan.

## Validointi ja virheiden käsittely

| Raja | Validointi | Virheen muoto | Sivuvaikutus |
| --- | --- | --- | --- |
| Project config/resources | Strict-v11 graph/capability/routes ilman v10 readeria, dual-writeä tai silent defaultia. | Tarkka issue-lista, käynnistys/commit estyy. | Ei osittaista config- tai Run-muutosta. |
| HTTP/API | Shared request/response schema ja application precondition. | 4xx odotetulle inputille, 5xx vain odottamattomalle virheelle. | Service-transaktio ei ala malformed-inputilla. |
| Composition | Profiili, instructionit, skillit, order, envelope ja output schema. | `ExecutionCompositionError` tai vastaava blocking outcome. | Nolla jonotettua taskia ja nolla fallbackia. |
| Runtime outcome | Roolikohtainen strict schema, current revision ja rajat. | Failed/needs_input/interrupted/terminal outcome. | Vain atomisesti commitoitu fakta näkyy. |
| Loop module | Koko, UTF-8, strict schema, canonical hash, conflict, stale plan ja active Run. | Domain issue -lista. | Config-last ja rollback; ei puuttuvia referenssejä. |
| UI projection | Shared DTO ja exhaustive presentation mapping. | Unknown/explicit unavailable; ei arvattua tilaa. | Display-only; canonical data ei muutu. |

Virheet ovat domain-faktoja vain, kun ne on persistentoitu oikeaan storeen. Logirivi tai providerin teksti ei yksinään muuta control flow’ta. Retry on rajattu runtime-sääntö, ei yleinen “catch and try again” -käytäntö.

## Persistence, atomisuus ja idempotenssi

- SQLite on machine-local canonical runtime truth; repository on canonical project truth.
- State-revisio käyttää monotonista revisionia ja expected-revision-tarkistusta.
- Outcome, revision ja control-flow-tapahtuma commitoidaan yhdessä, jos niiden erottaminen voisi näyttää mahdottoman välitilan.
- Queue/task lifecycle on persistentoitu: queued voidaan palauttaa, running muuttuu restartissa interrupted-tilaan eikä terminal-tulosta replayata.
- Cancellation/finalization toimii durable barrierina myöhäiselle adapter-payloadille.
- Module commit revalidoi suunnitelman ja kirjoittaa project configin viimeisenä, jotta config ei koskaan viittaa vielä puuttuvaan resurssiin.

## Determinismi ja provenance

Compositionin järjestys, resolved resource -sisältö, role schema, Task Envelope ja hash ovat osa suoritusevidenssiä. Provider tai adapteri ei valitse toista profiilia, mallia, instructionia tai skilliä puuttuvan tilalle. Loop module canonicalization tuottaa sisältöpohjaisen hashin; asennettu provenance kertoo, mistä materialisoitu project-local-sisältö on peräisin. Immutable Root Run -snapshot estää myöhempää config-muutosta muuttamasta ajon selitystä.

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
- Nykyisessä v10-baselinessa Context, composition ja detail ovat authoring-projektioita; vain omistetut `LoopEdge`/`Edge`-entiteetit ovat muokattavaa domain-dataa.
- Hyväksytyssä v11-targetissa authoring-projektiot ovat vain `graph | loop`: Graph Engineering näyttää `ProjectLoop`→`LoopNode`-projektiot, yhden Orchestrator-controlin ja persisted route-policyn, Loop Engineering vain valitun Loopin sisäisen komposition. Client layout/selection ei omista topologiaa.
- Mission kokoaa nykyisen tavoitteen ja aktiivisen polun; All Loops näyttää immutable snapshotin koko topologian.
- Position, role, profile, attempt, revision, repair, return ja finalization tulevat snapshotista ja canonical persistence -projektiosta.
- Visuaalinen artwork, orbit, glow tai reittikorostus auttaa lukemista mutta ei muodosta uutta runtime-tilaa.
- Prosenttia, ETA:a, elapsed-telemetriaa tai provider-tekstistä pääteltyä statusta ei esitetä, ellei tuleva kanoninen sopimus ja ADR sitä erikseen määritä.

## Versiointi ja yhteensopivuus

- `.ballet/project.json` käyttää strict-v11-skeemaa: graph omistaa `loopEdges`-reitit, Loop omistaa `accepts`/`provides`-capabilityt ja reitti nimeää capabilityn.
- V11-toteutus ei säilytä v10-parseria, compatibility-readeria, top-level `loopEdges`-rinnakkaismallia, dual-writeä tai silent defaultia. Numeric route -alias poistetaan vasta rajatussa frontend hard cut -vaiheessa.
- Shared API/TypeScript-sopimuksen semanttinen muutos vaatii toteutuksen ja kuluttajien koordinoidun päivityksen sekä testit.
- SQLite-schema muuttuu vain numeroiduilla migraatioilla. V11 snapshot tallennetaan nykyiseen snapshot-JSON-kenttään, joten tämä vaihe ei vaatinut uutta SQLite-migraatiota.
- Arc42/frontmatter stable ID säilyy sisältöpäivityksessä; `version` kasvaa vain semanttisesta dokumenttimuutoksesta.
- Hyväksytty ADR ei muutu hiljaisesti; uusi päätös supersedoi sen eksplisiittisesti.

## Kanoniset lähteet

ADR:t omistavat päätökset, `DESIGN.md` UI-järjestelmän, source/shared schemas suoritettavan käyttäytymisen ja tässä linkitetyt arc42-lähteet pitkäikäisen selityksen.

## Relevantit päätökset

`adr-002`, `adr-005`–`adr-008` ja `adr-011`–`adr-018`.

## Evidenssi

Konseptit mapittuvat BB-, RT-, DEP- ja QS-tunnisteisiin. TRACEABILITY nimeää testit ja evidenssit; tämän dokumentaatiotyön conformance review tarkistaa, ettei kuvaus väitä runtime-sopimuksen muutosta.

## Avoimet kysymykset

- Uutta konseptia ei nosteta tänne ilman usean rakennusosan vaikutusta tai priorisoitua laatuskenaariota.
- Operatiivisen telemetry-retentionin tarve arvioidaan ennen tuotantokäyttöä erillään arkkitehtuuridokumentaation säilytyksestä.

## Seuraava katselmointiperuste

Katselmoi osio, kun evaluation löytää toistuvan ristiriidan rakennusosien välillä tai prioriteetti-1-QS vailla yhteistä ratkaisua.
