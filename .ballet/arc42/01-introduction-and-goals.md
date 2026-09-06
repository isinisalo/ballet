---
id: arc42-section-01
title: Johdanto ja tavoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 22
tags: [arc42, requirements]
arc42Section: 1
---

# 1. Johdanto ja tavoitteet

Ballet ohjaa projektin tarkoitukseen perustuvaa toteutusta checkout-local Environment Runina. Ihminen omistaa WHAT/WHY:n, hyväksynnät ja ulkoiset kirjoitukset; platform omistaa deterministisen järjestyksen, Validation-led-laatuportin ja immutable evidenssin. User Storyjen hyväksyntä on project-local sopimus, jota Run ei käytä porttina, snapshottaa tai injektoi promptiin.

| ID | Project intent | Vaatimus | Hyväksymismitta |
| --- | --- | --- | --- |
| REQ-022 | [Overview](../overview.md#ordered-execution-and-validation) | Environmentin Statet ja Actionit toteutetaan järjestyksessä ilman ennenaikaista etenemistä; blocking on näkyvä ja Critic/Refinement vaativat ihmishyväksynnän. | QS-028–QS-032 |
| REQ-023 | [Overview](../overview.md#project-truth-and-explicit-context) | Markdown-authoring, kaksi kiinteää Codex governance-agenttia ja niiden human-approved Feedback/Refinement-raja toteutetaan ilman Environment/Validation-semanttiikan regressiota; terminal evidence ei ole Product. | QS-033–QS-037 |
| REQ-024 | [Overview](../overview.md#outcomes) | Yksi checkout-kohtainen local-only daemon suorittaa vain Codex CLI:n serverin omistamasta jonosta ilman Computer-, pairing-, provider-, network-, root- tai remote-checkout-valintoja ja palautuu fail-closed. | QS-038–QS-041 |
| REQ-025 | [Overview](../overview.md) | Four Project views with one content source; exact human story approval, preserved visual cards and Event Storming, safe conflicts, strict removal. | QS-046 |

Laatuprioriteetit ovat turvallisuus, jäljitettävyys, deterministinen eteneminen, palautettavuus ja saavutettava operaattorikokemus. Kanonisten päätösten etusija kuvataan [osiossa 9](09-architecture-decisions.md); projektimäärittelyn rajan päättää [ADR-048](../adr/adr-048-four-project-views.md). Mitat ovat [osiossa 10](10-quality-requirements.md) ja päästä päähän -ketju [TRACEABILITYssa](TRACEABILITY.md).

Sidosryhmät ovat projektin omistaja, agenttioperaattori, kehittäjä, arkkitehti, riippumaton Validation-katselmoija ja paikallinen ylläpitäjä. Kukaan agenteista ei saa korvata ihmisen User Story-, Critic-, Refinement- tai external-write-päätöstä.
