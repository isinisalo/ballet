---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 5
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta Ballet-runtimen lokeja tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-011` ovat accepted.
- `adr-001`–`adr-003`, `adr-005`–`adr-009` ja `adr-011`–`adr-017` ovat accepted. `adr-004` ja `adr-010` ovat superseded by `adr-015`; ADR-014:n V1 no-package -raja on osittain superseded by ADR-016.
- Strict-v10 project configuration, geneerinen Work Loop runtime, kuusi Codex-ExecutionProfilea, kahdeksan Loopia ja 20 Work Loop Nodea ovat nykyinen project-local-baseline.
- Yhden Loopin package inspection, project-local install/export/remove, Loop Library, content-derived provenance sekä yhdeksän starter-pakettia on toteutettu ilman runtime-aikaista package-riippuvuutta.
- Loop Engineerin Context-, composition- ja selected-Loop detail -projektiot on toteutettu muuttamatta strict-v10-runtime-entiteettejä.
- Run mission controlin Mission / All Loops / live inspector projisoi immutable snapshotin, canonical State/control flow’n ja finalizationin lisäämättä keksittyä progress- tai provider-derived-statea.
- Suomenkielinen kattava arc42-korpus ja `QS-011`–`QS-013` ovat `comprehensive-arc42-documentation`-draft-initiativen arvioitavana.
- 6+1 project-local Method on hyväksytty, mutta ensimmäinen end-to-end-pilotti ei ole vielä tuottanut operatiivisia METHOD-HEALTH-baselineja.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | Goal/ADR-status yllä; architecture ownership noudattaa ADR-011/015/016/017:ää. |
| Toteutettu fakta | Strict-v10 runtime, module materialization, Loop Engineer ja Run mission control löytyvät nykyisestä työpuusta. |
| Paikallinen evidenssi | EVID-011–EVID-013 sekä ARCDOC-EVID-001–005 ovat verified/passed 2026-08-17 paikallisissa tarkistuksissa; pilot/release-evidenssin pending-tilat säilyvät. |
| Avoin riski | RISK-001:n pilot gap, RISK-011:n 14 lint warningin baseline ja RISK-012:n Run-visualisoinnin tulkintariski. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet ovat [TRACEABILITYssa](TRACEABILITY.md), menetelmämetriikat [METHOD-HEALTHissa](METHOD-HEALTH.md) ja aktiivisen rajatun työn yksityiskohdat `initiatives/<initiative-id>/`-hakemistossa.

## Relevantit päätökset

`goal-009`, `goal-010`, `goal-011`, `adr-011`, `adr-015`, `adr-016` ja `adr-017`.

## Evidenssi

- `.ballet/project.json` on strict v10 ja määrittää 8 Loopia, 20 Work Loop Nodea, 6 Human Validation -porttia ja 35 LoopEdgeä.
- `.ballet/loop-library/arc42/` sisältää seitsemän itsenäisesti asennettavaa pakettia ja `.ballet/loop-library/software-delivery/` kaksi implementation-pakettia.
- Aiempi module-evidenssi on `installable-loop-modules`-initiativessa ja Loop Engineer -evidenssi `loop-engineer-three-level-canvas`-initiativessa.
- `comprehensive-arc42-documentation`-BRIEF/PLAN/EVIDENCE/REVIEW indeksoi tämän dokumentaatiomuutoksen.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- `OQ-002`: ensimmäisen pilotin Validation FAIL-, retry-, repair route- ja evidence gap -baselinet puuttuvat.
- Projektin omistajan arvio ratkaisee, hyväksytäänkö `comprehensive-arc42-documentation`-initiative.

## Nykyinen handoff

- Initiative: `comprehensive-arc42-documentation`.
- Status: `draft`; dokumentaatiototeutus ja paikallinen conformance review ovat valmiit, ihmisarvio puuttuu.
- Muuttuneet stable ID:t: nykyiset REQ-001–REQ-011, BB-001–BB-009, CON-001–CON-007 ja QS-001–QS-010 säilyvät; lisäykset ovat RT-008–RT-010, QS-011–QS-013, TEST-011–TEST-013, EVID-011–EVID-013, RISK-011 ja RISK-012.
- Seuraava hyväksytty toimi: projektin omistaja arvioi BRIEF/PLAN/EVIDENCE/REVIEW-ketjun ja hyväksyy tai palauttaa draftin.
- Stop condition: commit, release, deploy, merge ja push vaativat erillisen täsmällisen ihmisvaltuutuksen.

## Seuraava katselmointiperuste

Päivitä projektin omistajan review-päätöksen jälkeen tai kun accepted Goal/ADR muuttaa persistent project situationia.
