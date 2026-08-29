---
id: arc42-section-01
title: Johdanto ja tavoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 19
tags:
  - arc42
  - requirements
arc42Section: 1
---

# 1. Johdanto ja tavoitteet

## Tarkoitus

Ballet on yhteen Git-checkoutiin rajattu komentokeskus, jolla projektin omistaja kuvaa, suorittaa ja arvioi toistettavia AI-avusteisia työnkulkuja. Tämä osio tiivistää hyväksytyn tarkoituksen, olennaiset vaatimukset, tärkeimmät laatutavoitteet ja sidosryhmien odotukset. Hyväksytty WHAT/WHY säilyy Goal-tiedostoissa; tämä osio ei korvaa niitä.

## Tila ja väitteiden luokittelu

- **Hyväksytty tavoite:** `goal-022` / `REQ-022`, `adr-034` ja initiative `environment-state-action-orchestration` määrittävät strict Environment→State→Action -cutoverin. Ne ovat hyväksytty arkkitehtuurisopimus, mutta eivät vielä aktiivinen runtime.
- **Hyväksytty päätös:** `goal-021` / `REQ-021` ja `adr-033` omistavat aktiivisen hierarkkisen Graph/GraphNode Reward-MDP:n. `goal-020` / `adr-031` / `adr-032` ovat superseded niiden eksplisiittisesti nimetyiltä osilta.
- **Toteutettu fakta:** nykyinen työpuu sisältää strict-v19 Graph/GraphNode/ActionNode-domainin, Snapshot v12 / decision+observation v5 / SQLite v15 -runtime-evidenssin, erikseen compiled global/local-policyt ja 5×5/N×N-authoringin.
- **Hyväksytty domain:** viisi GraphNodea ja 17 ActionNodea ovat project-local baseline. Graph Node Module v7 kantaa kokonaisen local policyn; peer-GraphNode-matriisi ja acceptance pysyvät project-globalina.
- **Paikallinen evidenssi:** toteutuksen ajantasaisuus osoitetaan testeillä, buildilla ja `validate:arc42`-tarkistuksella; yksittäisen initiative-työn tulokset kirjataan sen EVIDENCE-tiedostoon.
- **Avoin riski:** ensimmäisen tuotantokaltaisen pilotin mitatut menetelmä- ja palautumisarvot puuttuvat vielä; katso [osio 11](11-risks-and-technical-debt.md).

## Olennaiset vaatimukset

| ID | Goal-lähde | Vaatimus | Arkkitehtuurin vastaus | Hyväksymisen päämitta |
| --- | --- | --- | --- | --- |
| REQ-001 | goal-001 | Toimi checkout-local-komentokeskuksena ilman Ballet-tiliä tai etäohjaustasoa. | Loopback-palvelu, täsmällinen checkout-raja ja paikallinen käyttöliittymä. | QS-001 |
| REQ-002 | goal-002 | Pidä projektin intentio ja automaatio siirrettävänä, versionhallittuna ja katselmoitavana. | `.ballet/project.json`, instructionit, skillit, Goals, ADR:t ja arc42 ovat project-local-lähteitä. | QS-002 |
| REQ-003 | goal-003 | Koosta provider-suoritus eksplisiittisestä `ExecutionProfile`-valinnasta, primary instructionista ja valituista skilleistä. | Deterministinen prompt composition ja provider-neutral adapter -raja. | QS-011 |
| REQ-004 | goal-004 säilyvä osa | Suorita työn tuottaminen ja validointi revisionoidulla Statella ja rajatulla retryllä. | Local policyn valitsema `ProjectActionNode`, Work→Validation, `retry | escalate`, atominen State/acceptance-commit ja strict outcome v9. | QS-003, QS-027 |
| REQ-005 | goal-005 | Eristä jokainen Root Run todennettavaan Git-worktreehen äläkä mergeä tai pushaa automaattisesti. | Immutable snapshot, erillinen branch/worktree ja eksplisiittinen ihmisvaltuutus ulkoisiin kirjoituksiin. | QS-004 |
| REQ-006 | goal-006 | Persistoi runtime-tila ja tarjoa restart-safe-evidenssi sekä observability. | SQLite-transaktiot, revisionit, tapahtumat ja recovery/reconciliation. | QS-012 |
| REQ-007 | goal-007 | Tarjoa tiheä, saavutettava ja yksiselitteinen operaattorikokemus. | Capability-first Graph/GraphNode-authoring, protected Action flow ja factual Run/policy evidence. | QS-013, QS-024 |
| REQ-008 | goal-008 | Tue validoitua macOS-paketointia ja checkout-kohtaista lifecycle-hallintaa. | arm64/x64-julkaisu, CLI ja launchd-palvelu. | QS-007 |
| REQ-009 | goal-009 | Käytä arc42:ta jaettuna arkkitehtuuritotuutena ja project-local GraphNodeja jatkuvana evidenssipohjaisena menetelmänä. | 12 kanonista osiota, DESIGNin 12 ActionNodea, viiden GraphNoden default Graph ja vakaat trace-ketjut. | QS-005, QS-006, QS-008 |
| REQ-010 | goal-010 säilyvä osa | Tarkasta, asenna, vie ja poista siirrettäviä Graph Node Moduleja ilman runtime-aikaista pakettiriippuvuutta. | Strict Module v7 sisältää local policyn ja materialisoituu inspect/plan/config-last-polulla. | QS-009, QS-027 |
| REQ-011 | goal-011 säilyvä osa | Authoroi Graph, GraphNode ja Action Node selkeissä URL-omisteisissa projektioissa. | Kolmitasoinen authoring, capability cards ja protected Action flow ilman client-owned topologyä. | QS-010, QS-024 |
| REQ-012 | goal-012 | Historiallinen Graph/Loop authoring- ja orchestrator-vaihe. | Superseded; aktiivinen raja on REQ-020 / ADR-031. | QS-014 (historical) |
| REQ-013 | goal-013 | Historiallinen Workflow/Edge-vaihe. | Superseded; Work→Validation ja bounded retry säilyvät Action Nodessa. | QS-015 (historical) |
| REQ-014 | goal-014 | Historiallinen exact RunBook -vaihe. | Superseded; project-local DESIGN/PLAN/BUILD/DEPLOY/VERIFY ja tracker-outbox säilyvät, control kuuluu REQ-020:lle. | QS-016–QS-018 (historical/säilyvin osin) |
| REQ-015 | goal-015 säilyvä osa | Säilytä Graph/GraphNode/Action Node -authoring ja Graph/GraphNode Root Run -rajat. | Strict v19, hierarchical global/local decisionit ja protected Action flow; scoped LLM-orchestrator/Repair-osat ovat superseded. | QS-020, QS-027 |
| REQ-016 | goal-016 | Historiallinen Graph-only finite SSP/SMDP -vaihe. | Superseded kokonaan goal-020:llä ja ADR-031:llä. | QS-021 (historical) |
| REQ-017 | goal-017 | Historiallinen scoped SSP-vaihe. | Vanha feature-state/agent-fallback-malli on superseded; ADR-033:n node-ID-local policy on eri aktiivinen sopimus. | QS-022, QS-023 (historical) |
| REQ-018 | goal-018 säilyvä osa | Näytä capabilityt korteilla ja scopekohtainen Decision Model omassa URL-osiossaan säilyttäen protected Action flow. | Capability Graph / global 5×5 sekä GraphNode Action Nodes / local N×N, atominen CRUD ja factual Run evidence. | QS-024, QS-027 |
| REQ-019 | goal-019 | Historiallinen offline calibration/promotion -vaihe. | Superseded; observations ovat immutable audit evidenceä eivätkä muuta tai promotoi mallia. | QS-025 (historical) |
| REQ-020 | goal-020 | Historiallinen yhden Graph Reward-MDP:n vaihe. | Outcome-aware reward, hard authorization ja deterministic compiler säilyvät ADR-033:ssa; single-policy/ledger-state/array-order ovat superseded. | QS-026 (historical) |
| REQ-021 | goal-021 | Valitse GraphNode globaalilla node-ID-policylla ja ActionNode GraphNoden omalla node-ID-policylla niin, että acceptance-ledger säilyy erillisenä evidenssiporttina. | Strict v19/v4/v7/v12/v5/v15, erilliset immutable global/local-policyt, exact local-terminal→Graph-outcome→ledger-portti ja semanttinen 5×5/N×N CSS-grid. | QS-027 |
| REQ-022 | goal-022 | Ohjaa hyväksyttyjen Use Casejen toteutusta järjestetyllä Environment→State→Action-mallilla, Validation-led-laatuportilla, näkyvällä Feedbackillä sekä ihmisen hyväksymillä Critic- ja Refinement-siirtymillä ilman ennenaikaista State-etenemistä. | Target Contract, ADR-034, immutable Environment Run, johdetut runtime-tilat, exact refinement -hyväksyntä ja strict phase-09 cutover. | QS-028–QS-032 |

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
| Agenttioperaattori | Näkee, mitä ajetaan, miksi policy valitsi actionin ja mihin kanoniseen faktaan näkymä perustuu. | Graph/GraphNode Run, Q/V/reward/PPM/acceptance-evidenssi, Action Node, attempt, revision ja finalization. |
| Riippumaton katselmoija | Arvioi BRIEF/PLAN/QS-kriteerien täyttymisen muuttamatta arvioitavaa toteutusta. | Diffi, nimetty evidenssi, testitulokset ja REVIEW. |
| Release-operaattori | Valtuuttaa ja havaitsee täsmällisen package/release/deploy/rollback-toimenpiteen. | Julkaisutarkistus ja erillinen ihmisvaltuutus. |
| Ylläpitäjä | Pystyy käynnistämään checkout-kohtaisen palvelun uudelleen menettämättä tai monistamatta työtä. | launchd/CLI-status, SQLite ja recovery-evidenssi. |

## Rajaus

Aktiivinen v19 omistaa yleiset Graph-, GraphNode-, aggregate Action Node-, Work/Validation-, scopekohtaiset Reward-MDP-, acceptance-, authorization-, runtime-, provider-, persistence- ja authoring-primitivet phase-09 cutoveriin asti. Hyväksytty tavoite korvaa nämä Environment-, State-, Action-, Validation-led-, Feedback-, Critic-, Refinement-, continuation- ja Product Snapshot -primitiveillä; standalone State- tai Action-runeja ei tule. Roadmap-, milestone-, release- ja arc42-menettelyt pysyvät project-local-datana. Tilit, keskitetty control plane, automaattinen agenttihyväksyntä, automaattinen merge/push sekä yleinen projektinhallintapalvelu ovat rajauksen ulkopuolella.

## Kanoniset lähteet

- `.ballet/goals/*.md` ja `.ballet/goals/summary.md`: hyväksytty WHAT/WHY.
- [STATUS](STATUS.md): pitkäikäinen nykytila ja handoff.
- [TRACEABILITY](TRACEABILITY.md): vaatimusten mitattavat ketjut.
- [osio 10](10-quality-requirements.md): laatutavoitteet ja skenaariot.

## Relevantit päätökset

`adr-001`, `adr-002`, `adr-011`, `adr-015`, `adr-016`, `adr-025`, `adr-027`, `adr-029` säilyvin osin, aktiivinen `adr-033` phase-09 cutoveriin asti sekä hyväksytty tavoitepäätös `adr-034`.

## Evidenssi

Goal-frontmatter, project-skeema, toteutuksen lähdeankkurit ja trace-matriisi osoittavat sovitun intentin ja toteutetun pinnan. Ajettujen tarkistusten tulokset eivät ole pysyvästi “verified” ilman nimettyä, ajankohtaista evidenssiriviä.

## Avoimet kysymykset

- Initiative-kohtaiset sidosryhmät, hyväksymismitat ja mahdollinen `needs_input` täsmennetään aina BRIEFissä.
- Ensimmäinen end-to-end-pilotti määrittää menetelmäterveyden lähtöarvot.

## Seuraava katselmointiperuste

Katselmoi osio, kun hyväksytty Goal muuttuu, projektin rajaus laajenee tai toistuva initiative-kohtainen odotus muuttuu koko tuotteen vaatimukseksi.
