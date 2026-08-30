---
id: arc42-section-01
title: Johdanto ja tavoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 21
tags: [arc42, requirements]
arc42Section: 1
---

# 1. Johdanto ja tavoitteet

Ballet ohjaa hyväksyttyjen Use Casejen toteutusta checkout-local Environment Runina. Ihminen omistaa WHAT/WHY:n, hyväksynnät ja ulkoiset kirjoitukset; platform omistaa deterministisen järjestyksen, Validation-led-laatuportin ja immutable evidenssin.

| ID | Goal | Vaatimus | Hyväksymismitta |
| --- | --- | --- | --- |
| REQ-022 | goal-022 | Hyväksytyt Use Caset toteutetaan järjestettyinä Stateina ja Actioneina ilman ennenaikaista etenemistä; blocking on näkyvä ja Critic/Refinement vaativat ihmishyväksynnän. | QS-028–QS-032 |
| REQ-023 | goal-023 | Markdown-authoring, projektin Agentit ja eksplisiittinen paired-daemon Computer/CLI -sidonta toteutetaan ilman Environment/Validation-semanttiikan regressiota; Feedback yksinkertaistuu ja terminal evidence ei ole Product. | QS-033–QS-037 |
| REQ-024 | goal-024 | Yksi checkout-kohtainen local-only daemon suorittaa Codex/Copilot-CLI:t serverin omistamasta jonosta ilman Computer-, pairing- tai remote-checkout-käsitteitä ja palautuu fail-closed; Validation ja subordinate Work jakavat Action-providerin ja policyn. | QS-038–QS-041 |

Laatuprioriteetit ovat turvallisuus, jäljitettävyys, deterministinen eteneminen, palautettavuus ja saavutettava operaattorikokemus. Kanoniset päätökset ovat `adr-034` ja sitä rajatusti supersedoiva `adr-035`; mitat ovat [osiossa 10](10-quality-requirements.md) ja päästä päähän -ketju [TRACEABILITYssa](TRACEABILITY.md).

Sidosryhmät ovat projektin omistaja, agenttioperaattori, kehittäjä, arkkitehti, riippumaton Validation-katselmoija ja paikallinen ylläpitäjä. Kukaan agenteista ei saa korvata ihmisen Use Case-, Critic-, Refinement- tai external-write-päätöstä.
