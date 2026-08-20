---
id: arc42-initiative-graph-and-loop-engineering-review
title: Graph and Loop Engineering REVIEW
status: draft
createdAt: '2026-08-19'
updatedAt: '2026-08-20'
version: 8
tags:
  - arc42
  - initiative
  - graph-engineering
  - review
---

# Graph and Loop Engineering REVIEW

## Tila

`draft`. Strict-v11 data/config/snapshot/module/runtime-, Graph/Loop-routing-, Graph Engineering-, Loop Engineering- ja Phase 6 project-local responsibility/library -vaiheet on toteutettu ja paikallinen tekninen evidenssi kerätty. Rajattu conformance-tarkistus on passed; koko initiativea ei hyväksytä ennen ihmisreview'ta.

## Review scope

Tuleva review vertaa `goal-012` / `REQ-012` / `QS-014` -aikomusta ADR-018:aan, PLANiin, todelliseen diffiin ja `TEST-014` / `EVID-014` -evidenssiin. Historiallisten ADR-015/017- ja Goal-011-osien säilyvä sekä supersedoitu raja arvioidaan erikseen.

## Fact

- Nykyinen config/domain/snapshot/module/runtime-baseline on strict v11; authoring-UI:ssa on vain Graph Engineering ja Loop Engineering.
- ADR-018, ADR-019 ja initiative-artefaktit muodostavat päätös- ja muutosrajan.
- GLE-EVID-002–008A ovat passed; GLE-EVID-009 on pending.

## Decision

Ei uutta review-päätöstä. `adr-018` ja Phase 6:n `adr-019` on hyväksytty käyttäjän eksplisiittisellä päätösvaltuutuksella, mutta initiative implementation acceptance ja lupa aloittaa seuraava vaihe ovat erilliset ihmisrajat.

## Assumption, Hypothesis ja Finding

- AS-GLE-001:n data/snapshot/module-osa on todennettu; HYP-GLE-001:n käyttöliittymävaikutus odottaa myöhempää evidenssiä.
- FIND-GLE-001:n automaattinen `followFlow` on poistettu ja runtime dispatch vastaa ADR-018:aa; UI/runtime-sanastoraja on tarkoituksella kesken.

## Per-QS verdict

| QS | Criterion | Evidence | Verdict |
| --- | --- | --- | --- |
| QS-014 | Strict-v11 hard cut, Orchestrator-owned flow/repair ja täsmälleen Graph/Loop-authoring | EVID-014 / GLE-EVID-002–009 | partial: technical implementation including Graph control-node passed; human acceptance pending |

## Risk, trace ja method health

RISK-013 ja TRACEABILITY erottavat läpäistyn data/snapshot/module-osavaiheen koko EVID-014:n pending-tilasta. METHOD-HEALTH ei muutu ilman runtime- tai menetelmäevidenssiä.

## Rajatun vaiheen conformance review

- **Implementation defect:** ei havaittu domain/config/snapshot/module-rajassa. Strict-v10 lukupolkuja, rinnakkaista top-level `loopEdges`-mallia, package Graphia/target-ID:tä tai platformiin vuotanutta project-workflow'ta löytyi 0.
- **Documentation drift:** TRACEABILITY ja RISK-013 kuvasivat koko implementationin pending-tilana erottelematta läpäistyä GLE-EVID-002/003/008-osavaihetta; korjattu säilyttäen EVID-014 pending-tilassa.
- **Acceptance coverage:** capability-listan max- ja trim-invarianteille lisättiin eksplisiittinen schema-testi. Koko dispatch/UI/ihmisacceptance pysyy avoimena eikä tätä review'ta tulkita initiative-acceptanceksi.
- **Phase 6 conformance:** passed. Jokaisella project Loopilla ja paketilla on yksi eksplisiittinen done-condition sekä yksi accepts/provides-raja; split-vastuut ovat omia paketteja, package/state/capability/provenance/hash-roundtrip ja capability-swap on testattu, graph on ainoa peer-topologialähde ja target-ID package-resurssissa hylätään.
- **Platform boundary:** passed. Project-workflow-ID:t ovat `.ballet/**`-datassa, generatorissa ja project-local testissä; `backend`, `frontend` ja `shared` -tuotantokoodiin ei lisätty workflow-nimiä tai target-reititystä.
- **Open question:** ei uutta tämän rajatun vaiheen WHAT/WHY- tai vaikeasti peruttavaa HOW-kysymystä.

## Riippumaton current-baseline conformance review

- **Implementation defect, korjattu:** 390×844 Graph inspector -Sheetin tabit, compact Select-triggerit ja close-ohjain olivat 28 px korkeita vastoin `DESIGN.md`:n 40 px narrow-control-rajaa. Shared Select-triggerin mobile-first size, Sheet close -touch target ja Graph inspector -tabit korjattiin ilman domain-, route- tai runtime-muutosta.
- **Conformance evidence:** GLE-EVID-006B todentaa nykyiset 11 LoopNodea, yhden Orchestratorin, Graphin 0 sisäistä nodea, persisted policy -projektion, Loop Engineeringin selected-Loop-only-rajan, URL/back/forward-käyttäytymisen, 390 px overflow-rajan ja korjatut 40 px ohjaimet.
- **Evidence limitation:** selain kirjasi Graph→Loop-siirtymässä hetkellisiä React Flow parent-size -varoituksia. Renderöity Loop Engineering -canvas, deep-link ja history toimivat; warning jää vähäiseksi visual-lifecycle-riskiksi eikä sitä tulkita hyväksytyksi ihmisarvioksi.
- **Documentation drift, korjattu:** `09-architecture-decisions.md` kuvasi toteutettua ADR-019-refaktorointia yhä käynnissä olevaksi ja v11 flow-dispatchia tulevaksi. Indeksi synkronoitiin nykyiseen toteutusevidenssiin muuttamatta accepted ADR-018/019-päätöksiä.
- **Acceptance boundary:** review pysyy `draft`-tilassa ja GLE-EVID-009 pending-tilassa. Auditointi ei myönnä release-, deploy-, merge-, push- tai muuta ulkoisen kirjoituksen valtuutusta.

## Handoff

- Current status: strict-v11 domain/schema/capability/snapshot/module/runtime- ja Phase 6 responsibility/library -rajat toteutettu; koko initiative draft.
- Next approved action: projektin omistaja katselmoi GLE-EVID-002–008A:n teknisen evidenssin ja hyväksyy tai palauttaa EVID-014-ketjun.
- Requested capability/outcome: Graph/Loop strict-v11 implementationin ihmisacceptance ilman release-, deploy-, merge- tai push-valtuutusta.
- Stop condition: release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat erillisen täsmällisen ihmisvaltuutuksen.

## Avoimet kysymykset

Ei päätösvaiheen WHAT/WHY-blockeria. REVIEW pysyy draftina, kunnes evidenssipohjainen implementation review ja vaadittu ihmisacceptance on tehty.
