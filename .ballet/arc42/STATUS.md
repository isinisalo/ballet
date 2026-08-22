---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 24
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta runtime-lokeja, ticket-sisältöä tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-016` ovat accepted.
- `goal-016`, `adr-026` ja `QS-021` hyväksyvät Graph-scopeen explicit `agent_v1 | ssp_v1` -strategian, proper-policy-semanticsin, fixed-point mallin ja v15/v8/v11 strict cutin.
- `adr-023` omistaa säilyvän Graph/GraphNode/JobNode-domainin, GraphNode-scope agent routingin ja bounded Repair Noden. `adr-025` omistaa Job Node -authoringin industrial flow -projektion; Graph/Graph Node -avaruuscanvasit säilyvät.
- Nykyinen hard cut on Project Config v15, Graph Node Module v4, Root Snapshot v8, Task Envelope/Outcome v7, composition v8, ExecutionSpec v9 ja SQLite v11. Compatibility-lukijoita, reittialiaksia, dual-writeä tai runtime-migraatiota ei ole.
- Oletusprojekti sisältää viisi GraphNodea ja 17 aggregate JobNodea, joilla jokaisella on erillinen Work- ja Validation-lapsi. Viiden Graph Noden nimet ja arc42-/release-menettely ovat project-local-dataa.
- Oletusprojekti käyttää Graph-scope `agent_v1`:ssä Luna/medium/network-off-profiilia; viisi paikallista GraphNode-orchestratoria käyttävät samaa profiilia ja globaalilla sekä jokaisella Graph Nodella on explicit Sol/medium/network-off Repair Node. `ssp_v1` ei kutsu Graph LLM:ää. Platform ei hardkoodaa malleja eikä GraphNode-nimiä eikä tee fallbackia.
- Julkiset Run-rajat ovat Graph Run ja GraphNode Run. Standalone JobNode Run ja schedule on poistettu. GraphNode Run käyttää Graph-tasoa vain repair-eskalaatioon.
- Canonical authoring-reitit ovat `/automation/graph`, `/automation/graph/nodes/:graphNodeId` ja `/automation/graph/nodes/:graphNodeId/jobs/:jobNodeId`; Run-reitit ovat `/run/graphs/:graphId` ja `/run/graph-nodes/:graphNodeId`.
- Kaikki kolme canvasia käyttävät suojattua 24 px gridia ja samoja tokeneita. Graph/Graph Node käyttävät planet/multi-ring/spoke-kieltä; Job Node käyttää deterministic industrial flow'ta, jossa vain Work/Validation ovat valittavia ja Next job on disabled ghost.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat edelleen täsmällisen ihmisvaltuutuksen.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | `goal-015` / `adr-023` määrittää kolmitasoisen domain/GraphNode-runtime-rajan, `adr-025` Job industrial flow -projektion ja `goal-016` / `adr-026` Graph strategy/policy -rajan. State-, snapshot-, worktree-, tracker/outbox-, ihmisvaltuutus- ja same-Validation repair-return -invariantit säilyvät. |
| Toteutettu fakta | Strict v15 domain/config, Snapshot v8, SQLite v11, agent/SSP strategy union, pure Decision State/admissibility/solver, append-only policy evidence, Graph/GraphNode Run services, 14 v4-pakettia ja kolme canonical routea löytyvät työpuusta. |
| Paikallinen evidenssi | Aiempi TGNE-EVID-001–005 säilyy Graph/Graph Node -baseline-evidenssinä. ADR-025:n unit/component/integration-, full gate-, desktop/narrow-browser- ja installed-app-evidenssi on passed ja indeksoitu `job-node-industrial-flow-canvas`-initiativeen. |
| Avoin riski | Uuden Job-flow'n ihmisvisual verdict ja ensimmäinen tuotantokaltainen Luna/Sol-pilotti puuttuvat. Ne eivät valtuuta releasea tai external writea. |
| Policy core | `stochastic-policy-orchestration` toteuttaa Capability Graph / Decision Model / Execution Graph -rajan, bounded Decision Staten, GraphNode Optionin, hard `A(s)`:n, explicit priors/costit, proper-policy value iterationin ja decision/observation-evidenssin. Täysi visual Policy Projection/editor on seuraava slice. |
| Policy evidence | SPO-EVID-000–006: human approval, arbitrary/full-rename schema, bounded sources, hard guard, solver, immutable snapshot, atomic SQLite evidence, outcome deviation, restart, full gate ja conformance passed. Full editor/projection, max-bound/cross-host, cancel-race ja pilot ovat review-rajalla. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet [TRACEABILITYssa](TRACEABILITY.md), State-raja [STATE-CONTRACTissa](STATE-CONTRACT.md), active UI-baseline [job-node-industrial-flow-canvas](initiatives/job-node-industrial-flow-canvas/BRIEF.md)-initiativessa ja accepted policy core [stochastic-policy-orchestration](initiatives/stochastic-policy-orchestration/BRIEF.md)-initiativessa.

## Relevantit päätökset

`goal-015`, `goal-016`, `adr-011`, `adr-015`, `adr-016`, `adr-023`, `adr-025` ja `adr-026`.

## Evidenssi

- `.ballet/project.json` on strict v15 ja määrittää explicit `agent_v1`-strategian, viisi GraphNodea, 17 JobNodea, scoped candidate-säännöt sekä explicit Luna/Sol-mappingit.
- `.ballet/graph-node-library/**` sisältää 14 strict-v4-pakettia.
- `TEST-019` / `EVID-019` omistaa domain/runtime/module/conformance-evidenssin.
- `TEST-020` / `EVID-020` omistaa canonical route-, scope-, a11y-, layout-, browser- ja visual-evidenssin.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.
- `TEST-021` / `EVID-021` omistaa accepted policy-ketjun; core implementation passed ja full gate/projection/pilot ovat pending.

## Avoimet kysymykset

- Hyväksyykö projektin omistaja desktop- ja narrow-selainevidenssin Graph/Graph Node -avaruusteeman sekä Job industrial flow'n kompaktiuden ja ymmärrettävyyden?
- Millainen success/failure/repair-jakauma ensimmäisessä tuotantokaltaisessa Graph Runissa todentaa Luna-routerin ja Sol-repairin käytännön fitnessin?
- Pinned tracker/provider live-smoke raportoidaan erikseen eikä hermetic testi korvaa sitä.
- Mitkä ensimmäisen pilotin featuret, priors/costit ja observed cost dimensions domain expert hyväksyy?

## Nykyinen handoff

- Initiative: `stochastic-policy-orchestration`.
- Status: `review`; accepted architecture, generic runtime-core ja full gate/conformance ovat valmiit; projection/benchmark/cancel-race/pilot ovat seuraavan slicen raja.
- Muuttunut stable chain: `goal-016`, `REQ-016`, `QS-021`, `adr-026`, `CON-012`, `BB-011`, `RT-016`, `RISK-018`, `TEST-021`, `EVID-021`.
- Seuraava yksi hyväksytty toimi: editor/projection/benchmark/cancel-race/pilot-slicen rajaus.
- Stop condition: deploy/release/merge/push vaatii erillisen täsmällisen valtuutuksen.

## Seuraava katselmointiperuste

Päivitä final gatejen, conformance Validationin, projektin omistajan visual review'n tai uuden hyväksytyn Goal/ADR-muutoksen jälkeen.
