---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 16
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta Ballet-runtimen lokeja tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-013` ovat accepted.
- `adr-001`–`adr-003`, `adr-005`–`adr-009` ja `adr-011`–`adr-021` ovat accepted. `adr-004` ja `adr-010` ovat superseded by `adr-015`; ADR-014:n V1 no-package -raja on osittain superseded by ADR-016 ja ADR-011:n kiinteä kuuden arc42-Loopin topologia osittain superseded by ADR-019. ADR-020 supersedoi ADR-015:n composite-mallin ja ADR-018:n selected-Loop-nimen/reitin. ADR-021 supersedoi vain ADR-020:n erillisten canvas-nodejen/endpointien projektion säilyttäen domain-, runtime- ja editorirajat.
- Strict-v12 project configuration, v2 Loop Module, geneerinen Workflow-runtime, kuusi Codex-ExecutionProfilea, 11 capability-metadatalla varustettua Loopia sekä 20 JobNode/ValidationNode-paria ovat nykyinen project-local-baseline.
- Yhden Loopin package inspection, project-local install/export/remove, Loop Library, content-derived provenance sekä yhteensä 19 Loop module -pakettia on toteutettu ilman runtime-aikaista package-riippuvuutta.
- Graph Engineering on default project-global authoring-näkymä ja Workflow Engineering selected-Loop-only sisäinen editori. Workflow-canvas näyttää yhden Job-artworkin per Job/Validation-pari sekä vain persisted straight/smart-smoothstep Pass/Fail Edget ilman Validation- tai PASS/FAIL-nodeja ja validate/retry-viivoja. Context-komponentti/projektio, numeric level -reitit, compatibility-aliakset, `view=loop` ja vanha käyttäjäcopy on poistettu tuotantokoodista.
- `goal-012` / `adr-018`:n first-class capability-, Graph-, snapshot-, target-riippumaton Loop module-, flow/repair Orchestrator-dispatch-, authoring-routing- ja Graph-control-raja on toteutettu. Graph Engineering näyttää yhden Orchestrator-control-noden, yhden LoopNoden per ProjectLoop sekä vain persisted policyyn ja canonical Run -evidenssiin perustuvat yhteydet.
- Run mission controlin Mission / All Loops / live inspector projisoi immutable snapshotin, canonical State/control flow’n ja finalizationin lisäämättä keksittyä progress- tai provider-derived-statea.
- Suomenkielinen kattava arc42-korpus ja `QS-011`–`QS-013` ovat `comprehensive-arc42-documentation`-draft-initiativen arvioitavana.
- Tech Stack Canvas, Architecture Communication Canvas ja retrospektiivinen Architecture Inception Canvas ovat `architecture-canvases`-draft-initiativen Markdown + Mermaid -korttiprojektioita; v1:n proosapainotteinen esitys palautettiin ja v2 korjattiin visuaaliseksi muuttamatta Goal-, ADR- tai runtime-omistajuutta.
- Project-local Ballet Method on hyväksytty; ADR-019:n yhden vastuun topologia korvaa kiinteän 6+1-listan, mutta ensimmäinen end-to-end-pilotti ei ole vielä tuottanut operatiivisia METHOD-HEALTH-baselineja.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | Goal/ADR-status yllä; nykyinen baseline noudattaa ADR-011/016/019:n source/module/project-rajoja, ADR-018:n Graph/Orchestrator-rajaa, ADR-020:n strict-v12 Workflow-rajaa ja ADR-021:n Job-only canvas-projektiota. ADR-015:n State/repair/continuation-invariantit säilyvät. |
| Toteutettu fakta | Strict-v12 config/domain, v5 snapshot/envelope/outcome, v2 module, v8 persistence, persisted generic Orchestration Request/route, Graph/Workflow-authoring routing, selected-Loop-only editor ja Run mission control löytyvät työpuusta. |
| Paikallinen evidenssi | Historialliset EVID-011–EVID-014-, ARCDOC- ja CANVAS-tulokset säilyvät. WFE-EVID-001–007 todentavat 2026-08-20 strict-v12/v2 domain/runtime/persistence/API/UI/module/project-local-pinnan; WFE-EVID-009 todentaa ADR-021 canvas-korjauksen, browser-QA:n ja final gatet. WFE-EVID-008 ihmisacceptance on pending. |
| Avoin riski | RISK-001:n pilot gap, RISK-011:n lint warning -baseline, RISK-012:n Run-visualisoinnin tulkintariski ja RISK-013:n Graph-controlin puuttuva ihmisacceptance/pidempiaikainen tulkintaevidenssi. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet ovat [TRACEABILITYssa](TRACEABILITY.md), menetelmämetriikat [METHOD-HEALTHissa](METHOD-HEALTH.md) ja aktiivisen rajatun työn yksityiskohdat `initiatives/<initiative-id>/`-hakemistossa.

## Relevantit päätökset

`goal-009`, `goal-010`, `goal-011`, `goal-012`, `adr-011`, `adr-015`, `adr-016`, `adr-017`, `adr-018` ja `adr-019`.

## Evidenssi

- `.ballet/project.json` on strict v12 ja määrittää 11 Loopia capabilityineen, 20 JobNodea, 20 paired ValidationNodea, 6 Human Validation -porttia ja `graph.loopEdges`-rakenteessa 62 capability-reittiä.
- `.ballet/loop-library/arc42/` sisältää 10 itsenäisesti asennettavaa pakettia, `.ballet/loop-library/software-engineering/` seitsemän yhden vastuun pilot-starteria ja `.ballet/loop-library/software-delivery/` kaksi capability-yhteensopivaa implementation-vaihtoehtoa.
- Aiempi module-evidenssi on `installable-loop-modules`-initiativessa ja historiallinen ADR-017-authoring-evidenssi `loop-engineer-three-level-canvas`-initiativessa.
- `graph-and-loop-engineering` sisältää v11-päätösrajan sekä domain/config/snapshot/module/runtime/routing/Graph/Loop UI -toteutusevidenssin; kokonaisacceptancen ihmisreview on pending.
- `workflow-engineering` sisältää strict-v12/v2-päätösrajan ja WFE-EVID-001–007:n passed teknisen evidenssin; desktop/narrow-ihmisreview on pending.
- `comprehensive-arc42-documentation`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi tämän dokumentaatiomuutoksen.
- `architecture-canvases`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi canvasien lähteet, acceptance-kriteerit, tarkistukset ja ihmisarvion.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- `OQ-002`: ensimmäisen pilotin Validation FAIL-, retry-, repair route- ja evidence gap -baselinet puuttuvat.
- Projektin omistajan visual QA ratkaisee `workflow-engineering`-initiativen desktop/narrow-acceptancen.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö `comprehensive-arc42-documentation`-initiative.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö kolme `architecture-canvases`-draft-projektiota; inception-hypoteesien hyöty- ja usability-evidenssi jää avoimeksi.

## Nykyinen handoff

- Initiative: `workflow-engineering`.
- Status: `draft`; `goal-013`, `adr-020` ja `adr-021` ovat accepted. WFE-step-001–005 ja step-007:n canvas-korjaus final gateineen on toteutettu, mutta koko `EVID-015`:n ihmisacceptance on pending. Aiemmat initiative-draftit ja historiallinen v11-evidenssi säilyvät erillisinä.
- Muuttunut stable evidenssi: `adr-021` tarkentaa `QS-015` / `TEST-015` / `EVID-015` -ketjun canvas-projektiota. WFE-EVID-001–007 säilyvät aiempana teknisenä evidenssinä ja WFE-EVID-009 todentaa korjatun canvasin testit, final gatet ja browser-QA:n.
- Seuraava hyväksytty toimi: projektin omistaja antaa WFE-EVID-008:n desktop/narrow-visual verdictin.
- Stop condition: initiative-acceptance tai ulkoinen commit/release/deploy/rollback/merge/push-työ vaatii oman täsmällisen valtuutuksensa.

## Seuraava katselmointiperuste

Päivitä projektin omistajan review-päätöksen jälkeen tai kun accepted Goal/ADR muuttaa persistent project situationia.
