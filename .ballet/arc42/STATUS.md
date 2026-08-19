---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-19'
version: 8
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
- `adr-001`–`adr-003`, `adr-005`–`adr-009` ja `adr-011`–`adr-018` ovat accepted. `adr-004` ja `adr-010` ovat superseded by `adr-015`; ADR-014:n V1 no-package -raja on osittain superseded by ADR-016. ADR-018 supersedoi tulevassa v11 hard cutissa osittain ADR-017:n Context/numeric-level-mallin ja ADR-015:n automaattisen `followFlow`-kohdan.
- Strict-v10 project configuration, geneerinen Work Loop runtime, kuusi Codex-ExecutionProfilea, kahdeksan Loopia ja 20 Work Loop Nodea ovat nykyinen project-local-baseline.
- Yhden Loopin package inspection, project-local install/export/remove, Loop Library, content-derived provenance sekä yhdeksän starter-pakettia on toteutettu ilman runtime-aikaista package-riippuvuutta.
- Loop Engineerin Context-, composition- ja selected-Loop detail -projektiot on toteutettu muuttamatta strict-v10-runtime-entiteettejä; tämä on edelleen nykyinen koodi- ja config-baseline.
- `goal-012` / `adr-018` hyväksyy strict-v11-targetin, jossa ainoat authoring-näkymät ovat Graph Engineering ja Loop Engineering, capability metadata on first-class ja flow/repair kulkevat Orchestrator-dispatchin kautta. Toteutus on pending.
- Run mission controlin Mission / All Loops / live inspector projisoi immutable snapshotin, canonical State/control flow’n ja finalizationin lisäämättä keksittyä progress- tai provider-derived-statea.
- Suomenkielinen kattava arc42-korpus ja `QS-011`–`QS-013` ovat `comprehensive-arc42-documentation`-draft-initiativen arvioitavana.
- Tech Stack Canvas, Architecture Communication Canvas ja retrospektiivinen Architecture Inception Canvas ovat `architecture-canvases`-draft-initiativen Markdown + Mermaid -korttiprojektioita; v1:n proosapainotteinen esitys palautettiin ja v2 korjattiin visuaaliseksi muuttamatta Goal-, ADR- tai runtime-omistajuutta.
- 6+1 project-local Method on hyväksytty, mutta ensimmäinen end-to-end-pilotti ei ole vielä tuottanut operatiivisia METHOD-HEALTH-baselineja.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | Goal/ADR-status yllä; nykyinen baseline noudattaa ADR-011/015/016/017:ää ja tuleva v11-target ADR-018:aa. |
| Toteutettu fakta | Strict-v10 runtime, module materialization, Loop Engineer ja Run mission control löytyvät nykyisestä työpuusta. |
| Paikallinen evidenssi | EVID-011–EVID-013, ARCDOC-EVID-001–005 ja CANVAS-EVID-001–008/010–012 ovat verified/passed 2026-08-17 paikallisissa tarkistuksissa. GLE-EVID-001 todentaa 2026-08-19 vain päätös-/dokumentaatiovaiheen; EVID-014 on pending. CANVAS-EVID-009 säilyttää v1:n ihmisreview'n `failed`-tuloksen; v2:n uusi ihmisarvio sekä pilot/release-evidenssi puuttuvat. |
| Avoin riski | RISK-001:n pilot gap, RISK-011:n 14 lint warningin baseline, RISK-012:n Run-visualisoinnin tulkintariski ja RISK-013:n v10/v11 cross-layer drift ennen hard cut -acceptancea. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet ovat [TRACEABILITYssa](TRACEABILITY.md), menetelmämetriikat [METHOD-HEALTHissa](METHOD-HEALTH.md) ja aktiivisen rajatun työn yksityiskohdat `initiatives/<initiative-id>/`-hakemistossa.

## Relevantit päätökset

`goal-009`, `goal-010`, `goal-011`, `goal-012`, `adr-011`, `adr-015`, `adr-016`, `adr-017` ja `adr-018`.

## Evidenssi

- `.ballet/project.json` on strict v10 ja määrittää 8 Loopia, 20 Work Loop Nodea, 6 Human Validation -porttia ja 35 LoopEdgeä.
- `.ballet/loop-library/arc42/` sisältää seitsemän itsenäisesti asennettavaa pakettia ja `.ballet/loop-library/software-delivery/` kaksi implementation-pakettia.
- Aiempi module-evidenssi on `installable-loop-modules`-initiativessa ja Loop Engineer -evidenssi `loop-engineer-three-level-canvas`-initiativessa.
- `graph-and-loop-engineering` sisältää v11-päätösrajan ja pending-toteutusevidenssin; se ei muuta yllä olevaa strict-v10-faktaa.
- `comprehensive-arc42-documentation`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi tämän dokumentaatiomuutoksen.
- `architecture-canvases`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi canvasien lähteet, acceptance-kriteerit, tarkistukset ja ihmisarvion.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- `OQ-002`: ensimmäisen pilotin Validation FAIL-, retry-, repair route- ja evidence gap -baselinet puuttuvat.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö `comprehensive-arc42-documentation`-initiative.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö kolme `architecture-canvases`-draft-projektiota; inception-hypoteesien hyöty- ja usability-evidenssi jää avoimeksi.

## Nykyinen handoff

- Initiative: `graph-and-loop-engineering`.
- Status: `draft`; `goal-012` ja `adr-018` ovat accepted, mutta strict-v11-toteutus ja EVID-014 ovat pending. Aiemmat `architecture-canvases`- ja `comprehensive-arc42-documentation`-draftit säilyvät erillisinä hyväksymättöminä initiativeina.
- Muuttuneet stable ID:t: `adr-018`, `REQ-012`, `QS-014`, `RT-011`, `RISK-013`, `TEST-014`, `EVID-014` ja `arc42-initiative-graph-and-loop-engineering-{brief,plan,evidence,review}`. `goal-012` säilytettiin muuttumattomana.
- Seuraava hyväksytty toimi: projektin omistaja katselmoi tämän päätösvaiheen ja valtuuttaa tai palauttaa GLE-step-001:n strict-v11 domain/schema/capability -toteutuksen.
- Stop condition: tuotantokoodin seuraava toteutusvaihe sekä commit, release, deploy, rollback, merge ja push vaativat erillisen täsmällisen ihmisvaltuutuksen.

## Seuraava katselmointiperuste

Päivitä projektin omistajan review-päätöksen jälkeen tai kun accepted Goal/ADR muuttaa persistent project situationia.
