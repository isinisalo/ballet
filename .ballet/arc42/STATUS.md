---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-21'
version: 18
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta runtime-lokeja, ticket-sisältöä tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-014` ovat accepted.
- `adr-001`–`adr-003`, `adr-005`–`adr-009` ja `adr-011`–`adr-022` ovat accepted. `adr-004` ja `adr-010` ovat superseded by `adr-015`. `adr-020` supersedoi strict-v11 Workflow-rakenteen ja `adr-021` tarkentaa Workflow-canvasin suojattua projektiota. `adr-022` supersedoi ADR-018:n tavallisen flow-targetin agenttireitityksen sekä ADR-019:n yhden arc42-vastuun per Loop -rajauksen muuttamatta niiden historiallista päätösevidenssiä.
- Nykyinen hard cut on Project Config V13, Root Snapshot V6, Task Envelope/Outcome V6, prompt composition V7, ExecutionSpec V8, runtime DB V9 ja Loop Module Package V3. Compatibility-lukijoita ei ole.
- Oletusprojekti sisältää viisi Loopia, 17 JobNode/ValidationNode-paria ja 18 named transitionia: DESIGNin 12 arc42-osiota, PLANin kaksi tehtävää sekä BUILD-, DEPLOY- ja VERIFY-vaiheiden yhden tehtävän. Oletusgraafissa ei ole repair-edgejä.
- Platform tukee geneerisesti 1–40 Loopia, named RunBook-transitioneja, erillisiä repair call/return -reittejä, Graph/Loop Root Runeja ja scheduled isolated JobNode -ajoja ilman project-workflow'n nimien kovakoodausta.
- `tk` on pinnatun käyttäytymisen pakollinen konekohtainen prerequisite Graph Runille. SQLite v9 tracker-outbox ja linkit sovittavat orchestration- ja work-storeja idempotentisti; frontendissä ei ole ticket-editoria.
- Loop Library sisältää viisi `graph-engineering`-pakettia ja yhdeksän V3:een muunnettua geneeristä pakettia. `recommendedTransitions`, `recommendedRepairs` ja DEPLOYn `externalWrites: requires-human-authorization` ovat package-dataa, eivät runtime-aikainen riippuvuus.
- Graph Engineering käyttää pelkistettyä determinististä layered layoutia. Workflow Engineeringin tumma tekninen ruudukko, Job-artworkit, koot, hehkut, amber-ID:t, mint-edget ja connection pointit säilyvät suojattuna visuaalisena sopimuksena.
- Story/Release Map omistaa toimitusjärjestyksen; work-store toteutustaskit. DEPLOY vaatii edelleen täsmällisen ihmisvaltuutuksen eikä tämä muutos valtuuta deployta, mergeä tai pushia.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | `goal-014` / `adr-022` määrittää viiden Loopin RunBook-, state-, tracker-, module- ja UI-rajan. Aiemmat hyväksytyt State revision-, repair return-, permission- ja Workflow-visuaali-invariantit säilyvät. |
| Toteutettu fakta | V13/V3/DB9-sopimukset, exact `GraphRunbookEngine`, Graph/Loop root-kindit, viiden Loopin project-data, tracker-adapter/outbox/CLI, Graph editor/layout sekä architecture source-of-truth löytyvät työpuusta. |
| Paikallinen evidenssi | `GER-EVID-001`–`GER-EVID-006` läpäisivät: 495 testiä, strict-v13 arc42/config-gate, V3 module/release smoke, 1/5/40 layout-testit, desktop/narrow browser-QA, build, DESIGN-lint, boundary search ja diff check. Lintissä on 0 virhettä ja sama 14 warningin baseline. |
| Avoin riski | RISK-001:n tuotantokaltainen pilotti, RISK-011:n lint-baseline, RISK-016:n pinnattu live `tk` -smoke ja RISK-017:n ihmisvisual review ovat avoimia. RISK-015 on teknisesti kontrolloitu local final gateillä. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet ovat [TRACEABILITYssa](TRACEABILITY.md), menetelmämetriikat [METHOD-HEALTHissa](METHOD-HEALTH.md), bounded State [STATE-CONTRACTissa](STATE-CONTRACT.md) ja aktiivisen työn yksityiskohdat [graph-engineering-runbook](initiatives/graph-engineering-runbook/BRIEF.md)-initiativessa.

## Relevantit päätökset

`goal-014`, `adr-011`, `adr-015`, `adr-016`, `adr-020`, `adr-021` ja `adr-022`.

## Evidenssi

- `.ballet/project.json` on V13 ja määrittää 5 Loopia, 17 Job/Validation-paria, 18 transitionia, 0 oletus-repairia ja kaksi worktree-local tracker-storea.
- `.ballet/loop-library/graph-engineering/` sisältää viisi V3-pakettia; software-engineering- ja software-delivery-paketit säilyvät geneerisinä V3-paketteina.
- [Story/Release Map](../releases/STORY-RELEASE-MAP.md) sisältää stable release/story ID:t eikä kopioi implementation issueita.
- `graph-engineering-runbook`-EVIDENCE indeksoi TEST-016–TEST-018:n sekä läpäisseet browser-, module-, release- ja repository-gatet; live `tk` on erikseen pending.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.

## Avoimet kysymykset

- `OQ-002`: ensimmäisen tuotantokaltaisen viiden Loopin pilotin repair-, tracker- ja method-health-baseline puuttuu.
- Projektin omistajan visual review ratkaisee Graph Engineeringin desktop/narrow-acceptancen ja vahvistaa Workflow Engineeringin suojatun ilmeen säilymisen.
- Optional live `tk` -smoke riippuu pinnatun prerequisite-komennon paikallisesta saatavuudesta; hermetic suite ei korvaa sitä.

## Nykyinen handoff

- Initiative: `graph-engineering-runbook`.
- Status: `draft`; `goal-014` ja `adr-022` ovat accepted, tekniset final gatet ovat läpäisseet ja ihmisacceptance on pending.
- Muuttunut stable evidenssi: `QS-016`–`QS-018`, `TEST-016`–`TEST-018`, `EVID-016`–`EVID-018`, CON-009/010 sekä BB-/RT-/DEP-päivitykset muodostavat uuden trace-ketjun.
- Seuraava hyväksytty toimi: projektin omistaja antaa nimetylle Graph/Workflow browser-evidenssille visual verdictin; pinnatun `tk`:n live-smoke voidaan ajaa, kun prerequisite on tarkoituksellisesti saatavilla.
- Stop condition: deploy, release, rollback, merge tai push vaatii oman täsmällisen ihmisvaltuutuksensa.

## Seuraava katselmointiperuste

Päivitä final gatejen, projektin omistajan review-päätöksen tai uuden hyväksytyn Goal/ADR-muutoksen jälkeen.
