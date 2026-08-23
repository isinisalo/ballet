---
id: arc42-index
title: Balletin arc42-arkkitehtuuri-indeksi
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 21
tags:
  - arc42
  - architecture
  - index
---

# Balletin arc42-arkkitehtuuri-indeksi

## Nykytila

12-osioinen baseline on accepted. Aktiivinen implementation on `goal-020` / `adr-031`: yksi Graph-tason `reward_mdp_v3`, immutable acceptance- ja authorization-snapshotit, kerran compiled discounted policy ja ordered GraphNode execution. Strict cut on v18/v3/v6/v11/v9/v10/v11/v4/v14. Scoped agent/local-policy/Repair/shadow/promotion-mallit ovat historiallisia, eivät active runtimea.

## Osiot

1. [Johdanto ja tavoitteet](01-introduction-and-goals.md)
2. [Rajoitteet](02-constraints.md)
3. [Konteksti ja rajaus](03-context-and-scope.md)
4. [Ratkaisustrategia](04-solution-strategy.md)
5. [Rakennusosanäkymä](05-building-block-view.md)
6. [Ajonäkymä](06-runtime-view.md)
7. [Käyttöönottonäkymä](07-deployment-view.md)
8. [Poikkileikkaavat konseptit](08-crosscutting-concepts.md)
9. [Arkkitehtuuripäätökset](09-architecture-decisions.md)
10. [Laatuvaatimukset](10-quality-requirements.md)
11. [Riskit ja tekninen velka](11-risks-and-technical-debt.md)
12. [Sanasto](12-glossary.md)

## Tukilähteet

- [STATUS](STATUS.md): pitkäikäinen nykytila ja yksi seuraava handoff.
- [TRACEABILITY](TRACEABILITY.md): Goal/REQ–QS–ADR/CON–BB–RT–TEST–EVID-ketjut.
- [METHOD-HEALTH](METHOD-HEALTH.md): vain mitattu menetelmäevidenssi.
- [STATE-CONTRACT](STATE-CONTRACT.md): bounded project State; authorization ja acceptance pysyvät erillisinä snapshoteina.
- [Graph Reward-MDP initiative](initiatives/graph-reward-mdp/BRIEF.md): tämän hard cutin BRIEF/PLAN/EVIDENCE/REVIEW.
- [Initiative template](initiatives/TEMPLATE/BRIEF.md): uuden rajatun työn rakenne.

Vanhat initiativet säilyvät historiallisena evidenssinä. Niiden scoped agent/SSP/Repair/calibration-väitteet eivät ohita `adr-031`:n supersessionia.

## Kanoninen omistajuus

| Lähde | Omistaa | Ei omista |
| --- | --- | --- |
| `.ballet/goals/**` | WHAT/WHY ja supersession | Runtime-toteutuksen yksityiskohta |
| `.ballet/adr/**` | Arkkitehtuuripäätös ja trade-off | Runtime-logi |
| Osiot 1–12 | Pitkäikäiset arkkitehtuurinäkymät | Goal/ADR-tekstin kopio |
| Initiative | Rajattu sopimus, suunnitelma, evidenssi ja review | Koko projektin rinnakkainen totuus |
| `STATUS` / `TRACEABILITY` / `METHOD-HEALTH` | Handoff, suhteet ja mitattu tila | Keksitty pilottievidenssi |
| `DESIGN.md` | UI-tokenit ja suojattu canvas | Runtime control state |
| `.git/ballet` | Machine-local runtime truth | Versionhallittu intentio |

## Työskentelysääntö

Epäselvä WHAT/WHY, laatuprioriteetti, merkittävä ADR tai external-write-valtuutus pysähtyy `needs_input`-tilaan. Validation-evidenssi ei valtuuta deployta. Policy observation ei mutatoi immutablea mallia.

## Evidenssi

`npm run validate:arc42` tarkistaa dokumenttirakenteen, linkit, trace-ID:t, project-resurssit ja strict-v18 Reward-MDP -defaultin. Tuotantokaltainen pilotti on pending, kunnes nimetty Root Run -evidenssi on olemassa.
