---
id: arc42-index
title: Balletin arc42-arkkitehtuuri-indeksi
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 26
tags: [arc42, architecture, index]
---

# Balletin arc42-arkkitehtuuri-indeksi

Kanoninen runtime-semanttiikka on `goal-022` / `adr-034`: Environment -> State -> Action ja Validation-led execution. `goal-023` / `adr-035` säilyttävät Markdown Agents-, Feedback/Refinement v2- ja Run Evidence -mallin. Aktiivisen execution placementin omistaa `goal-024` / `adr-037`: yksi checkout-local daemon ilman Computeria tai pairingia. `adr-036` määrittää Loop Engineeringin canvas-projektiot.

1. [Johdanto ja tavoitteet](01-introduction-and-goals.md)
2. [Rajoitteet](02-constraints.md)
3. [Konteksti ja rajaus](03-context-and-scope.md)
4. [Ratkaisustrategia](04-solution-strategy.md)
5. [Rakennusosanäkymä](05-building-block-view.md)
6. [Ajonaikainen näkymä](06-runtime-view.md)
7. [Käyttöönottonäkymä](07-deployment-view.md)
8. [Poikkileikkaavat konseptit](08-crosscutting-concepts.md)
9. [Arkkitehtuuripäätökset](09-architecture-decisions.md)
10. [Laatuvaatimukset](10-quality-requirements.md)
11. [Riskit ja tekninen velka](11-risks-and-technical-debt.md)
12. [Sanasto](12-glossary.md)

Tukilähteet: [STATUS](STATUS.md), [TRACEABILITY](TRACEABILITY.md), [METHOD-HEALTH](METHOD-HEALTH.md), [runtime state contract](STATE-CONTRACT.md), [active target contract](initiatives/markdown-agent-daemon-orchestration/TARGET-CONTRACT.md) ja [Loop Engineering visual initiative](initiatives/loop-engineering-space-and-action-flow/BRIEF.md). Historialliset initiativet ja superseded ADR:t ovat audit trailia, eivät aktiivinen vaihtoehtoinen arkkitehtuuri.
