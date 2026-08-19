---
id: arc42-initiative-graph-and-loop-engineering-brief
title: Graph and Loop Engineering BRIEF
status: draft
createdAt: '2026-08-19'
updatedAt: '2026-08-19'
version: 2
tags:
  - arc42
  - initiative
  - graph-engineering
  - loop-engineering
---

# Graph and Loop Engineering BRIEF

## Intentio ja omistajuus

- Initiative ID: `graph-and-loop-engineering`.
- Owner: projektin omistaja ja päävastuullinen repository-arkkitehti.
- Goal / Requirement: `goal-012` / `REQ-012`.
- Decision: `goal-012` hyväksyy WHAT/WHY-rajan ja `adr-018` HOW-rajan.
- Status: `draft`; strict-v11 data/config/snapshot/module-vaihe on toteutettu, mutta tämä BRIEF ei väitä koko initiativea valmiiksi eikä valtuuta ulkoista kirjoitusta.

## Fact

- Nykyinen data-baseline on strict v11 ja Root Execution Snapshot v4. URL-ohjattu Context / Level 1 / Level 2 -Loop Engineer sekä nykyinen cross-Loop-control flow säilyvät vielä muuttumattomina.
- Nykyinen repair kulkee Orchestratorin kautta ja palaa durable call framella samaan Validationiin.
- Nykyinen top-level flow seuraa automaattisesti enintään yhtä lähtevää `flow`-LoopEdgeä `LoopCompletionEngine.followFlow`-polussa.
- Nykyinen Graphia vastaava Level 1 näyttää `ProjectLoop`it ja `ProjectLoopEdge`-yhteydet, mutta Orchestrator on inspectorissa eikä control-nodena canvasilla.

## Decision

Tuote siirtyy kahteen authoring-näkymään: default **Graph Engineering** ja selected-Loop-only **Loop Engineering**. Graph on `ProjectAutomationConfig`-aggregaatin project-global projektio, yksi `ProjectLoop` näkyy yhtenä `LoopNode`-projektiona ja `LoopOrchestrator` omana control-projektiona. Strict v11 keskittää flow- ja repair-route-candidatet graphiin ja kaikki cross-Loop-valinnat Orchestratorille.

## Stakeholderit ja odotukset

| Stakeholder | Odotus |
| --- | --- |
| Projektin omistaja | Näkee todellisen project-global orchestrationin ja säilyttää permission- sekä external-write-valtuutuksen. |
| Loop-authori | Voi kehittää yhden Loopin Work/Validation-sisäosan tuntematta peer-Loopeja. |
| Graph-authori / arkkitehti | Koostaa flow- ja repair-allowlistat capabilityjen avulla yhdessä näkymässä. |
| Operaattori | Erottaa route-policyn, Orchestrator-controlin ja canonical runtime-evidenssin ilman fake-tilaa. |
| Module-authori | Paketoi yhden riippumattoman Loopin ilman peer-target-ID:tä tai runtime-package-riippuvuutta. |
| Riippumaton katselmoija | Voi todentaa hard cutin, supersession-rajan ja Goal→evidence-ketjun. |

## Scope

- Strict-v11-domain, Zod/schema ja first-class Loop capability metadata.
- Project-global graphin flow- ja repair-route-policy.
- Immutable Root Run snapshot, persistence/read model ja Loop module -materialisointi v11:een.
- Flow- ja repair-dispatch `LoopOrchestrator`in kautta, mukaan lukien ambiguity/permission `needs_input`.
- Context- ja numeric-level-legacykoodin poisto.
- Graph Engineering -UI sekä nykyisen selected-Loop-only canvasin säilyttäminen Loop Engineeringinä.
- Project-local Loop Libraryn capability- ja target-riippumattomuuden päivitys.
- Domain-, schema-, snapshot-, persistence-, runtime-, API-, routing-, projection-, UI-, module- ja smoke-testit sekä dokumentaatio.

## Non-goals

- Uusi `LoopNode`- tai Graph-runtime-entiteetti.
- Nested Loop -domain tai Loopin sisään tallennettu peer-Loop.
- Client-owned topology state, persisted canvas layout tai fake runtime -edge.
- V10 compatibility reader, automaattinen migraatio, alias-route, dual-write tai silent default.
- Project-workflow'n nimeäminen platform-koodissa.
- Remote module registry, uusi marketplace tai runtime-aikainen package dependency.
- Release, deploy, rollback, merge tai push.

## Rajoitteet ja rajapinnat

- ADR-011:n source-of-truth, ADR-015:n State/repair/continuation-invariantit ja ADR-016:n yhden Loopin package-raja säilyvät ADR-018:n täsmennysten mukaisesti.
- V11 on yksi koordinoitu hard cut domainin, schema/API:n, snapshotin, persistenssin, runtimen, UI:n ja fixtureiden läpi.
- Route on kelvollinen vain immutable snapshotin graph-allowlistassa ja capability-yhteensopivana.
- Loopin sisäinen task, instruction, skill, State-contract, outcome ja module package eivät saa nimetä peer-targetia.
- Permission escalation ei myönnä oikeutta; ambiguity ja ihmisvaltuutus pysähtyvät `needs_input`-tilaan.
- UI käyttää vain `DESIGN.md`-tokeneita eikä error-väriä Orchestratorin normaalina identiteettinä.

## Acceptance intent

`QS-014` toteutuu vasta, kun strict v11 hylkää v10:n ilman compatibility-polkuja, Graph/Loop-reitit ovat ainoat authoring-reitit, Context-legacy on poistettu, Graph näyttää kaikki LoopNode-projektiot ja yhden Orchestrator-controlin, Loop Engineering säilyttää selected-Loop-only sisäosan ja runtime-testit osoittavat sekä flow- että repair-dispatchin snapshot/capability/allowlist/`needs_input`-semantiikan.

Täysi acceptance vaatii `TEST-014` / `EVID-014`-ketjun sekä projektin omistajan review'n. Tämä rajattu vaihe todentaa domain/config/snapshot/module-rajat, ei runtime-dispatchia tai authoring-UI:ta.

## Assumption, Hypothesis ja Finding

- **Assumption AS-GLE-001:** nykyinen Level 2 -canvas voidaan nimetä ja reitittää Loop Engineeringiksi ilman sisäisen `ProjectWorkLoopNode`-semantiikan redesignia. Todennetaan Loop UI -vaiheessa.
- **Hypothesis HYP-GLE-001:** project-global route-policy ja näkyvä Orchestrator-control vähentävät virheellistä oletusta, että source Loop itse valitsee peer-targetin. Todennetaan routing/UI-testien ja ihmisreview'n kautta.
- **Finding FIND-GLE-001:** v10:n automaattinen `followFlow` on ristiriidassa hyväksytyn kaikkien cross-Loop-valintojen Orchestrator-omistajuuden kanssa; ADR-018 rajaa korjauksen v11-toteutusvaiheeseen.

## Avoimet kysymykset

- Ei päätösvaiheen WHAT/WHY- tai merkittävää HOW-blockeria. Toteutusvaiheen mahdollinen uusi, vaikeasti peruttava valinta palautetaan `needs_input`-tilaan eikä täytetä silent defaultilla.

## Evidenssi ja seuraava hyväksyntäraja

Lähteet: `goal-012`, `adr-018`, ADR-015/017, strict-v11 data/snapshot/module-koodi ja testit sekä käyttäjän 2026-08-19 vaihevaltuutus. Seuraava runtime- tai UI-vaihe vaatii projektin omistajan eksplisiittisen luvan.
