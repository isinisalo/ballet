---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 14
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta Ballet-runtimen lokeja tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-012` ovat accepted.
- `adr-001`–`adr-003`, `adr-005`–`adr-009` ja `adr-011`–`adr-019` ovat accepted. `adr-004` ja `adr-010` ovat superseded by `adr-015`; ADR-014:n V1 no-package -raja on osittain superseded by ADR-016 ja ADR-011:n kiinteä kuuden arc42-Loopin topologia osittain superseded by ADR-019. ADR-018:n hard cut on toteutettu; Phase 6:n yhden vastuun Loop -evidenssi on initiative-reviewssa.
- Strict-v11 project configuration, geneerinen Work Loop runtime, kuusi Codex-ExecutionProfilea, 11 capability-metadatalla varustettua Loopia ja 20 Work Loop Nodea ovat nykyinen project-local-baseline.
- Yhden Loopin package inspection, project-local install/export/remove, Loop Library, content-derived provenance sekä yhteensä 19 Loop module -pakettia on toteutettu ilman runtime-aikaista package-riippuvuutta.
- Graph Engineering on default project-global authoring-näkymä ja Loop Engineering selected-Loop-only sisäinen editori. Context-komponentti/projektio, numeric level -reitit, compatibility-aliakset ja vanha käyttäjäcopy on poistettu tuotantokoodista.
- `goal-012` / `adr-018`:n first-class capability-, Graph-, snapshot-, target-riippumaton Loop module-, flow/repair Orchestrator-dispatch-, authoring-routing- ja Graph-control-raja on toteutettu. Graph Engineering näyttää yhden Orchestrator-control-noden, yhden LoopNoden per ProjectLoop sekä vain persisted policyyn ja canonical Run -evidenssiin perustuvat yhteydet.
- Run mission controlin Mission / All Loops / live inspector projisoi immutable snapshotin, canonical State/control flow’n ja finalizationin lisäämättä keksittyä progress- tai provider-derived-statea.
- Suomenkielinen kattava arc42-korpus ja `QS-011`–`QS-013` ovat `comprehensive-arc42-documentation`-draft-initiativen arvioitavana.
- Tech Stack Canvas, Architecture Communication Canvas ja retrospektiivinen Architecture Inception Canvas ovat `architecture-canvases`-draft-initiativen Markdown + Mermaid -korttiprojektioita; v1:n proosapainotteinen esitys palautettiin ja v2 korjattiin visuaaliseksi muuttamatta Goal-, ADR- tai runtime-omistajuutta.
- Project-local Ballet Method on hyväksytty; ADR-019:n yhden vastuun topologia korvaa kiinteän 6+1-listan, mutta ensimmäinen end-to-end-pilotti ei ole vielä tuottanut operatiivisia METHOD-HEALTH-baselineja.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | Goal/ADR-status yllä; nykyinen baseline noudattaa ADR-011/015/016/017:ää, v11-raja ADR-018:aa ja project-local responsibility-granulariteetti ADR-019:ää. |
| Toteutettu fakta | Strict-v11 config/domain/snapshot/module/runtime-raja, persisted generic Orchestration Request/route, Graph/Loop-authoring routing, selected-Loop-only editor ja Run mission control löytyvät työpuusta. |
| Paikallinen evidenssi | EVID-011–EVID-013, ARCDOC-EVID-001–005 ja CANVAS-EVID-001–008/010–012 ovat verified/passed 2026-08-17 paikallisissa tarkistuksissa. GLE-EVID-002–008A todentavat 2026-08-20 mennessä strict-v11 data/snapshot/module/runtime/routing/Graph/Loop UI- ja Phase 6 responsibility/library -vaiheet; GLE-EVID-006B todentaa current 11-Loop -browser-projektion ja korjatut 40 px narrow-ohjaimet. EVID-014:n ihmisacceptance on pending. CANVAS-EVID-009 säilyttää v1:n ihmisreview'n `failed`-tuloksen; v2:n uusi ihmisarvio sekä pilot/release-evidenssi puuttuvat. |
| Avoin riski | RISK-001:n pilot gap, RISK-011:n lint warning -baseline, RISK-012:n Run-visualisoinnin tulkintariski ja RISK-013:n Graph-controlin puuttuva ihmisacceptance/pidempiaikainen tulkintaevidenssi. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet ovat [TRACEABILITYssa](TRACEABILITY.md), menetelmämetriikat [METHOD-HEALTHissa](METHOD-HEALTH.md) ja aktiivisen rajatun työn yksityiskohdat `initiatives/<initiative-id>/`-hakemistossa.

## Relevantit päätökset

`goal-009`, `goal-010`, `goal-011`, `goal-012`, `adr-011`, `adr-015`, `adr-016`, `adr-017`, `adr-018` ja `adr-019`.

## Evidenssi

- `.ballet/project.json` on strict v11 ja määrittää 11 Loopia capabilityineen, 20 Work Loop Nodea, 6 Human Validation -porttia ja `graph.loopEdges`-rakenteessa 62 capability-reittiä.
- `.ballet/loop-library/arc42/` sisältää 10 itsenäisesti asennettavaa pakettia, `.ballet/loop-library/software-engineering/` seitsemän yhden vastuun pilot-starteria ja `.ballet/loop-library/software-delivery/` kaksi capability-yhteensopivaa implementation-vaihtoehtoa.
- Aiempi module-evidenssi on `installable-loop-modules`-initiativessa ja historiallinen ADR-017-authoring-evidenssi `loop-engineer-three-level-canvas`-initiativessa.
- `graph-and-loop-engineering` sisältää v11-päätösrajan sekä domain/config/snapshot/module/runtime/routing/Graph/Loop UI -toteutusevidenssin; kokonaisacceptancen ihmisreview on pending.
- `comprehensive-arc42-documentation`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi tämän dokumentaatiomuutoksen.
- `architecture-canvases`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi canvasien lähteet, acceptance-kriteerit, tarkistukset ja ihmisarvion.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- `OQ-002`: ensimmäisen pilotin Validation FAIL-, retry-, repair route- ja evidence gap -baselinet puuttuvat.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö `comprehensive-arc42-documentation`-initiative.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö kolme `architecture-canvases`-draft-projektiota; inception-hypoteesien hyöty- ja usability-evidenssi jää avoimeksi.

## Nykyinen handoff

- Initiative: `graph-and-loop-engineering`.
- Status: `draft`; `goal-012` ja `adr-018` ovat accepted. GLE-step-001–007 on toteutettu, mutta koko `EVID-014`:n ihmisacceptance on pending. Aiemmat `architecture-canvases`- ja `comprehensive-arc42-documentation`-draftit säilyvät erillisinä hyväksymättöminä initiativeina.
- Muuttunut stable evidenssi: `GLE-EVID-006B` on passed current-baseline-auditista; accepted `goal-012`, `adr-018`, `REQ-012`, `QS-014` ja muut päätös-ID:t säilyivät semanttisesti muuttumattomina.
- Seuraava hyväksytty toimi: projektin omistaja katselmoi GLE-EVID-002–008A:n teknisen evidenssin ja hyväksyy tai palauttaa koko `EVID-014`-ketjun.
- Stop condition: initiative-acceptance tai ulkoinen commit/release/deploy/rollback/merge/push-työ vaatii oman täsmällisen valtuutuksensa.

## Seuraava katselmointiperuste

Päivitä projektin omistajan review-päätöksen jälkeen tai kun accepted Goal/ADR muuttaa persistent project situationia.
