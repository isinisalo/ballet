---
id: arc42-section-01
title: Johdanto ja tavoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 10
tags:
  - arc42
  - requirements
arc42Section: 1
---

# 1. Johdanto ja tavoitteet

## Tarkoitus

Ballet on yhteen Git-checkoutiin rajattu komentokeskus, jolla projektin omistaja kuvaa, suorittaa ja arvioi toistettavia AI-avusteisia työnkulkuja. Tämä osio tiivistää hyväksytyn tarkoituksen, olennaiset vaatimukset, tärkeimmät laatutavoitteet ja sidosryhmien odotukset. Hyväksytty WHAT/WHY säilyy Goal-tiedostoissa; tämä osio ei korvaa niitä.

## Tila ja väitteiden luokittelu

- **Hyväksytty päätös:** `goal-001`–`goal-015` määrittävät tuotteen tarkoituksen ja laajuuden.
- **Toteutettu fakta:** nykyinen työpuu sisältää checkout-local-palvelun, strict-v14 Graph/GraphNode/JobNode-domainin, scoped agent routing/repair -runtimen ja kolme URL-ohjattua avaruuscanvasia.
- **Hyväksytty target:** `goal-015` / `adr-023` määrittää viiden project-local GraphNoden, 17 aggregate JobNoden, Luna-orchestratorien, Sol Repair Nodejen ja Graph Node Module v4 -rajan; initiative-evidenssi on pending final gate/browser review.
- **Paikallinen evidenssi:** toteutuksen ajantasaisuus osoitetaan testeillä, buildilla ja `validate:arc42`-tarkistuksella; yksittäisen initiative-työn tulokset kirjataan sen EVIDENCE-tiedostoon.
- **Avoin riski:** ensimmäisen tuotantokaltaisen pilotin mitatut menetelmä- ja palautumisarvot puuttuvat vielä; katso [osio 11](11-risks-and-technical-debt.md).

## Olennaiset vaatimukset

| ID | Goal-lähde | Vaatimus | Arkkitehtuurin vastaus | Hyväksymisen päämitta |
| --- | --- | --- | --- | --- |
| REQ-001 | goal-001 | Toimi checkout-local-komentokeskuksena ilman Ballet-tiliä tai etäohjaustasoa. | Loopback-palvelu, täsmällinen checkout-raja ja paikallinen käyttöliittymä. | QS-001 |
| REQ-002 | goal-002 | Pidä projektin intentio ja automaatio siirrettävänä, versionhallittuna ja katselmoitavana. | `.ballet/project.json`, instructionit, skillit, Goals, ADR:t ja arc42 ovat project-local-lähteitä. | QS-002 |
| REQ-003 | goal-003 | Koosta provider-suoritus eksplisiittisestä `ExecutionProfile`-valinnasta, primary instructionista ja valituista skilleistä. | Deterministinen prompt composition ja provider-neutral adapter -raja. | QS-011 |
| REQ-004 | goal-004 | Suorita työn tuottaminen ja validointi revisionoidulla Statella, rajatulla retryllä, repairilla ja ajastuksella. | Strict-v13 `ProjectWorkflow`, `JobNode`, `ValidationNode`, `PassEdge`, `FailEdge`, `State`, RunBook-transition ja erillinen repair-edge. | QS-003 |
| REQ-005 | goal-005 | Eristä jokainen Root Run todennettavaan Git-worktreehen äläkä mergeä tai pushaa automaattisesti. | Immutable snapshot, erillinen branch/worktree ja eksplisiittinen ihmisvaltuutus ulkoisiin kirjoituksiin. | QS-004 |
| REQ-006 | goal-006 | Persistoi runtime-tila ja tarjoa restart-safe-evidenssi sekä observability. | SQLite-transaktiot, revisionit, tapahtumat ja recovery/reconciliation. | QS-012 |
| REQ-007 | goal-007 | Tarjoa tiheä, saavutettava ja yksiselitteinen operaattorikokemus. | Kanoniseen dataan perustuvat Graph/Workflow Engineering ja Run mission control. | QS-013 |
| REQ-008 | goal-008 | Tue validoitua macOS-paketointia ja checkout-kohtaista lifecycle-hallintaa. | arm64/x64-julkaisu, CLI ja launchd-palvelu. | QS-007 |
| REQ-009 | goal-009 | Käytä arc42:ta jaettuna arkkitehtuuritotuutena ja Ballet Loopseja jatkuvana evidenssipohjaisena menetelmänä. | 12 kanonista osiota, DESIGNin 12 osiokohtaista JobNodea, viiden Loopin project-local RunBook ja vakaat trace-ketjut. | QS-005, QS-006, QS-008 |
| REQ-010 | goal-010 | Tarkasta, asenna, vie ja poista siirrettäviä yhden Loopin moduuleja ilman runtime-aikaista pakettiriippuvuutta. | Rajattu JSON-paketti sekä inspect/plan/commit-materialisointi project-local-resursseiksi. | QS-009 |
| REQ-011 | goal-011 | Authoroi Loopsit erillisten Context-, composition- ja selected-Loop-detail-projektioiden kautta yksiselitteisellä Edge-omistajuudella. | Kolmitasoinen authoring-projektio, joka ei lisää runtime-entiteettejä. | QS-010 |
| REQ-012 | goal-012 | Authoroi project-global graph ja yhden Loopin sisäinen rakenne täsmälleen Graph Engineering / Loop Engineering -näkymissä sekä reititä kaikki cross-Loop-valinnat capabilityn ja snapshot-allowlistin kautta Orchestratorilla. | Strict-v11 graph/capability hard cut, `LoopNode`- ja Orchestrator-control-projektiot sekä selected-Loop-only Loop Engineering. | QS-014 |
| REQ-013 | goal-013 | Authoroi valitun Loopin sisäinen Workflow erillisinä Job/Validation-nodeina ja eksplisiittisinä Pass/Fail Edgeinä sekä eskaloi retryrajan jälkeinen FAIL Graph Orchestratorille. | Strict-v12/v2 Workflow hard cut, kiinteät Job→Validation- ja retry-siirtymät, Workflow PASS/FAIL -endpointit ja canonical `view=workflow`. | QS-015 |
| REQ-014 | goal-014 | Suorita Graph deterministisenä viiden Loopin RunBookina, pidä tavalliset transitionit erillään repair call/returnista ja sovita release-/implementation-työ fail-closedisti `tk`:hon. | Strict-v13/v3 hard cut, exact snapshot-transitionit, `GraphOrchestrationStateV1`, SQLite v9 tracker-outbox, GraphEngineeringStateV1 ja project-local DESIGN/PLAN/BUILD/DEPLOY/VERIFY-data. | QS-016, QS-017, QS-018 |
| REQ-015 | goal-015 | Korvaa aktiivinen Loop/Workflow-malli kolmella Graph/GraphNode/JobNode-tasolla, anna scoped orchestratorien tehdä tasojen väliset päätökset ja käsittele vaikeat poikkeukset bounded Repair Nodella. | Strict-v14/v4/v7/v8/v9/v10 hard cut, scoped candidate-enumit, Luna/Sol-project profiles, Graph/GraphNode Runeja ja kolme suojattua avaruuscanvasia. | QS-019, QS-020 |

Täydelliset mitattavat skenaariot ja evidenssistatukset ovat [osiossa 10](10-quality-requirements.md), ja päästä päähän -ketjut ovat [TRACEABILITYssa](TRACEABILITY.md).

## Kolme tärkeintä laatutavoitetta

1. **Turvallisuus:** paikalliset ja ulkoiset vaikutukset noudattavat checkout-, worktree-, verkko- ja ihmisvaltuutusrajoja. Väärä tai puuttuva valtuutus johtaa nollaan ulkoiseen kirjoitukseen.
2. **Jäljitettävyys:** intentio, päätökset, rakenteet, runtime-skenaariot, testit ja evidenssi liittyvät toisiinsa vakailla tunnisteilla ilman rinnakkaista totuutta.
3. **Palautettavuus:** Root Run jatkuu vain täysin commitoiduista State- ja control-flow-faktoista; restart, interruption ja cancellation eivät monista jo hyväksyttyä vaikutusta.

Prioriteettijärjestys on hyväksytty Goal- ja ADR-korpuksessa. Yksittäinen initiative voi tarkentaa mittaa, mutta ei vaihtaa näiden tavoitteiden järjestystä ilman ihmispäätöstä.

## Sidosryhmät ja odotukset

| Sidosryhmä | Odotus | Tarvittava näkymä/evidenssi |
| --- | --- | --- |
| Projektin omistaja | Säilyttää WHAT/WHY:n, prioriteetin, hyväksymisen ja ulkoisten kirjoitusten vallan. | Goalit, BRIEF, Human Validation, REVIEW ja täsmällinen valtuutus. |
| Ohjelmistoarkkitehti | Näkee rakenteet, rajapinnat, transaktiot, päätökset, riskit ja driftin yhtenä kokonaisuutena. | arc42-osiot, ADR-linkit, TRACEABILITY ja conformance review. |
| Kehittäjä | Saa rajatun muutospinnan, lähdekoodiankkurit, invariantit ja toistettavat tarkistukset. | PLAN, BB/RT/CON-kuvaukset, testit ja build. |
| AI-agentti | Saa yksiselitteisen nykytilan, sallitut resurssit, roolin, output-skeeman ja pysähtymisehdot ilman implisiittistä projektityönkulkua. | Immutable snapshot, `TaskEnvelope`, instruction/skill-resoluutio ja Validation-tulos. |
| Agenttioperaattori | Näkee, mitä ajetaan, missä roolissa ja mihin kanoniseen faktaan näkymä perustuu. | Mission, All Loops, live inspector, attempt/revision/repair/return/finalization. |
| Riippumaton katselmoija | Arvioi BRIEF/PLAN/QS-kriteerien täyttymisen muuttamatta arvioitavaa toteutusta. | Diffi, nimetty evidenssi, testitulokset ja REVIEW. |
| Release-operaattori | Valtuuttaa ja havaitsee täsmällisen package/release/deploy/rollback-toimenpiteen. | Julkaisutarkistus ja erillinen ihmisvaltuutus. |
| Ylläpitäjä | Pystyy käynnistämään checkout-kohtaisen palvelun uudelleen menettämättä tai monistamatta työtä. | launchd/CLI-status, SQLite ja recovery-evidenssi. |

## Rajaus

Ballet omistaa yleiset Graph-, GraphNode-, aggregate JobNode-, scoped orchestrator/repair-, runtime-, provider-, persistence- ja authoring-primitivet. Roadmap-, milestone-, release- ja arc42-menettelyt ovat project-local-dataa. Tilit, keskitetty control plane, schedule, standalone JobNode Run, automaattinen merge/push sekä yleinen projektinhallintapalvelu ovat rajauksen ulkopuolella.

## Kanoniset lähteet

- `.ballet/goals/*.md` ja `.ballet/goals/summary.md`: hyväksytty WHAT/WHY.
- [STATUS](STATUS.md): pitkäikäinen nykytila ja handoff.
- [TRACEABILITY](TRACEABILITY.md): vaatimusten mitattavat ketjut.
- [osio 10](10-quality-requirements.md): laatutavoitteet ja skenaariot.

## Relevantit päätökset

`adr-001`, `adr-002`, `adr-011`, `adr-015`, `adr-016` ja `adr-023`.

## Evidenssi

Goal-frontmatter, project-skeema, toteutuksen lähdeankkurit ja trace-matriisi osoittavat sovitun intentin ja toteutetun pinnan. Ajettujen tarkistusten tulokset eivät ole pysyvästi “verified” ilman nimettyä, ajankohtaista evidenssiriviä.

## Avoimet kysymykset

- Initiative-kohtaiset sidosryhmät, hyväksymismitat ja mahdollinen `needs_input` täsmennetään aina BRIEFissä.
- Ensimmäinen end-to-end-pilotti määrittää menetelmäterveyden lähtöarvot.

## Seuraava katselmointiperuste

Katselmoi osio, kun hyväksytty Goal muuttuu, projektin rajaus laajenee tai toistuva initiative-kohtainen odotus muuttuu koko tuotteen vaatimukseksi.
