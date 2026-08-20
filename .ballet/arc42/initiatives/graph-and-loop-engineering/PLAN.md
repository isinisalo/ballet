---
id: arc42-initiative-graph-and-loop-engineering-plan
title: Graph and Loop Engineering PLAN
status: draft
createdAt: '2026-08-19'
updatedAt: '2026-08-20'
version: 7
tags:
  - arc42
  - initiative
  - graph-engineering
  - plan
---

# Graph and Loop Engineering PLAN

## Tila

GLE-step-001–007a on toteutettu. Vaihe 6 materialisoi yhden vastuun project-local Loopit, 19 paketin starter/library-kokonaisuuden ja ADR-019:n supersession-rajan ilman platform-workflow-kovakoodausta. Snapshot säilyy immutable JSONina ja runtime orchestration käyttää hard-cut SQLite schema v7:ää. GLE-step-005:n project-global Graph-projektio sisältää yhden Orchestrator-control-noden, persisted policy -edge-presentationin ja canonical Run -evidenssin. GLE-step-008:n ihmisacceptance on `pending`.

## Vaihe 6 auditointi · GLE-AUDIT-001

Auditointi tehtiin ennen `.ballet/project.json`- tai Loop Library -datamuutoksia 2026-08-20. Arviointiperuste on `goal-012`:n yhden vastuun ja yhden rajatun onnistumisrajan sopimus sekä `adr-016` / `adr-018`:n yhden Loopin package- ja peer-riippumattomuus.

| Kohde | Finding | Vaihe 6 -toimi |
| --- | --- | --- |
| `arc42-design-structures` project Loop ja package | Yksi Loop tuottaa kolme erillistä canonical outputia: solution strategy, Building Block View ja architecture-significant runtime/deployment. Yksi `arc42:structures.designed`-raja ei osoita, mikä näistä on valmis. | Korvataan kolmella project-local Loopilla ja paketilla, joilla on omat accepts/provides-capabilityt, Work/Validation-kompositiot ja measurable done-conditionit. |
| Muut nykyiset arc42 Loopit | Usea Work Loop Node voi olla yhden vastuun sisäinen toteutusketju, mutta kuvauksista puuttuu eksplisiittinen yksi done-condition. `arc42-design-concepts` yhdistää lisäksi crosscutting concept -suunnittelun ja ADR-päätösportin. | Täsmennetään jokaisen säilyvän Loopin yksi onnistumisraja; erotetaan architecture decision omaksi starteriksi ja jätetään crosscutting concept -Loopille vain concept-vastuu. |
| Arc42 Loop Libraryn capabilityt | Packageissa käytetään osin `arc42:*`-tunnisteiden eri `-`-muotoa kuin strict-v11 project datan `.`-muotoa, joten custom ja installed module eivät kuvaa samaa capability metadataa. | Generoidaan package capabilityt samasta project-local määrittelystä ja testataan exact install/export-roundtrip. |
| Software-delivery starterit | Backend/frontend-paketit ovat yhden bounded implementation -vastuun vaihtoehtoja, mutta niiden capabilityt eivät osoita vaihdettavuutta eikä library sisällä omistajan Phase 6 -pilotiksi nimeämiä specification/strategy/decision/UI/deploy-vastuita. | Lisätään rajatut starterit ja capability-compatible implementation-vaihtoehdon swap-testi ilman source- tai peer-package-muutosta. |
| Topologia ja target-viitteet | Kaikki nykyiset peer-route-candidatet ovat `.ballet/project.json`-graphissa, mutta conformance-testin pitää osoittaa myös tunnetun target Loop ID:n esiintyminen package-resurssissa virheeksi. | Säilytetään graph ainoana topologialähteenä ja laajennetaan package/conformance-testit explicit target-ID -tapaukseen. |

Auditoinnin rajaus ei muuta platform-schemaa, Orchestrator-runtimea tai hyväksyttyä permission-mallia. Project-local workflow-ID:t saavat muuttua vain `.ballet/**`-, `.agents/**`-, fixture- ja testidatassa.

| Step ID | Vaihe | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GLE-step-001 | Domain / schema / capability | goal-012 / REQ-012 | QS-014 | adr-018 / CON-002, CON-004 | BB-003, BB-005 | RT-011 / DEP-001 | `shared/domain/automation.ts`, project/workspace schemas, config repository ja validator | strict-v11 domain/schema/config-testit; v10/unknown/default/dual-write rejection | GLE-EVID-002 |
| GLE-step-002 | Snapshot / persistence / module | goal-012 / REQ-012 | QS-014 | adr-015, adr-016, adr-018 / CON-002, CON-007 | BB-003–BB-005, BB-009 | RT-011 / DEP-001, DEP-002 | Root snapshot, SQLite schema/stores/read models, Loop Module package/install/export/materialization | snapshot closure-, schema migration-, recovery- ja module smoke -testit | GLE-EVID-003 |
| GLE-step-003 | Runtime orchestration | goal-012 / REQ-012 | QS-003, QS-014 | adr-015, adr-018 / CON-002 | BB-004–BB-006 | RT-003, RT-011 / DEP-002 | `LoopOrchestrator`, `LoopCompletionEngine`, role outcomes/envelopes ja control-flow events | zero/one/many flow-, repair-return-, ambiguity-, permission-, limit- ja restart-testit | GLE-EVID-004 |
| GLE-step-004 | Context-poisto ja routing hard cut | goal-012 / REQ-012 | QS-014 | adr-018 / CON-005 | BB-001 | RT-011 / DEP-001 | frontend route union/parser/generators, shell ja Context-projektio/komponentit | vain `graph | loop`, canonical URLs, back/forward ja legacy-term/reitti-poistotestit | GLE-EVID-005 |
| GLE-step-005 | Graph Engineering UI | goal-007, goal-012 / REQ-007, REQ-012 | QS-013, QS-014 | adr-018 / CON-005 | BB-001, BB-002, BB-005 | RT-010, RT-011 / DEP-001 | graph projection/layout/canvas, LoopNode, Orchestrator control, route-policy editor ja inspector | projection/UI/keyboard/a11y/desktop/narrow-testit ja visual QA | GLE-EVID-006 |
| GLE-step-006 | Loop Engineering UI | goal-011, goal-012 / REQ-011, REQ-012 | QS-010, QS-014 | adr-017, adr-018 / CON-005 | BB-001 | RT-011 / DEP-001 | selected-Loop-only canvas/editor, header/actions ja module handoff | sisäisen domain-semanttiikan regressio-, deep-link-, editor- ja viewport-testit | GLE-EVID-007 |
| GLE-step-007 | Project-local Loop Library | goal-010, goal-012 / REQ-010, REQ-012 | QS-009, QS-014 | adr-016, adr-018 / CON-007 | BB-003, BB-008, BB-009 | RT-006, RT-007, RT-011 / DEP-001 | `.ballet/loop-library/**`, materialisoitu project-local data, instructionit/skillit ja provenance | package/install/export/API/UI/release smoke sekä peer-target/platform-boundary-haku | GLE-EVID-008 |
| GLE-step-007a | Vaihe 6 yhden vastuun Loopit ja starter library | goal-010, goal-012 / REQ-010, REQ-012 | QS-009, QS-014 | adr-016, adr-018, adr-019 / CON-007 | BB-003, BB-008, BB-009 | RT-006, RT-007, RT-011 / DEP-001 | `.ballet/project.json`, `.ballet/loop-library/**`, project-local instructionit/skillit, fixturet ja provenance | responsibility/done-condition, strict capability, package cardinality, install/export/hash/provenance, topology-only, swap, module/API/UI/release smoke ja target-ID conformance | GLE-EVID-008A |
| GLE-step-008 | Verification ja acceptance | goal-012 / REQ-012 | QS-014 | adr-011, adr-018, adr-019 / CON-006 | BB-001–BB-009 | RT-003, RT-011 / DEP-001, DEP-002 | koko diffi, docs, TRACEABILITY, EVIDENCE ja REVIEW | `validate:arc42`, test, lint, build, design lint, boundary/legacy searches, smoke ja `git diff --check` | EVID-014 / GLE-EVID-009 |

## Järjestys ja riippuvuudet

1. V11 domain/schema lukitsee capability- ja graph-route-muodon ennen snapshotin tai UI:n muuttamista.
2. Snapshot/persistence/module-raja on valmis ennen runtime-dispatchia, joten tuleva Orchestrator lukee canonical v11 -evidenssiä.
3. Runtime flow/repair semantics valmistuu ennen Graph UI:n väitettä Orchestrator-controlista.
4. Context- ja numeric-route-legacy poistetaan samassa frontend hard cutissa, jossa Graph/Loop-route otetaan käyttöön.
5. Loop Engineering säilyttää sisäisen editorin, mutta v11 DTO:t ja module handoff koordinoidaan ennen acceptancea.
6. Jokainen rajattu vaihe ajaa oman verification-matriisinsa. Koko EVID-014-acceptance ajetaan vasta kaikkien cross-layer-muutosten jälkeen.

## Migration, compatibility ja legacy removal

- Repository-owned `.ballet/project.json`, fixturet, package-esimerkit ja materialisointitestit muunnetaan eksplisiittisesti strict v11:ksi.
- V10 readeria, converteria, dual-writeä, silent defaultia, `loopEdges`-rinnakkaismallia, `context | composition | detail` -unionia tai numeric `level` -routea ei jätetä.
- Context-komponentti/projektio/copy/testit poistetaan vasta frontend-toteutusvaiheessa, ei tässä päätösvaiheessa.
- Historiallisia Goaleja, ADR:iä tai valmistuneen v10-initiativen evidenssiä ei kirjoiteta uudelleen.

## Riskit

- Vain UI:n muuttaminen jättäisi runtime-driftin; GLE-step-003 edeltää Graph UI -acceptancea.
- Hard cut voi jättää fixture- tai module-polun v10:een; GLE-step-008 sisältää rajatun legacy-haun ja kaikki smoke-polut.
- Capability-sopimus voi muuttua project-workflow-DSL:ksi; schema sallii vain geneeriset capability- ja route-primitivet.
- Multi-candidate-flow voi valita targetin hiljaa; yksi tai useampi candidate kulkee Orchestrator-dispatchin kautta ja ambiguity pysähtyy `needs_input`-tilaan.
- Nykyisen Loop editorin regressio voi hukkua laajaan diffiin; GLE-step-006 säilyttää selected-Loop-only-testit erillisenä gatena.

## Tarkistukset

Täysi toteutusvaihe ajaa vähintään `npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build`, `npx @google/design.md lint DESIGN.md`, platform/project-boundary- ja legacy-haut, Loop module smoke -matriisin, browser/visual QA:n ja `git diff --check`.

## Avoimet kysymykset ja stop condition

Uusi schema-, capability-DSL-, permission- tai topology-valinta, jota ADR-018 ei ratkaise yksiselitteisesti, pysäyttää toteutuksen `needs_input`-tilaan. Tämä PLAN ei valtuuta releasea, deployta, rollbackia, mergeä tai pushia.
