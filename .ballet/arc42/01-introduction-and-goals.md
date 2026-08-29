---
id: arc42-section-01
title: Johdanto ja tavoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 20
tags: [arc42, requirements]
arc42Section: 1
---

# 1. Johdanto ja tavoitteet

Ballet ohjaa hyväksyttyjen Use Casejen toteutusta checkout-local Environment Runina. Ihminen omistaa WHAT/WHY:n, hyväksynnät ja ulkoiset kirjoitukset; platform omistaa deterministisen järjestyksen, Validation-led-laatuportin ja immutable evidenssin.

| ID | Goal | Vaatimus | Hyväksymismitta |
| --- | --- | --- | --- |
| REQ-022 | goal-022 | Hyväksytyt Use Caset toteutetaan järjestettyinä Stateina ja Actioneina ilman ennenaikaista etenemistä; blocking on näkyvä ja Critic/Refinement vaativat ihmishyväksynnän. | QS-028–QS-032 |

Laatuprioriteetit ovat turvallisuus, jäljitettävyys, deterministinen eteneminen, palautettavuus ja saavutettava operaattorikokemus. Kanoninen päätös on `adr-034`; mitat ovat [osiossa 10](10-quality-requirements.md) ja päästä päähän -ketju [TRACEABILITYssa](TRACEABILITY.md).

Sidosryhmät ovat projektin omistaja, agenttioperaattori, kehittäjä, arkkitehti, riippumaton Validation-katselmoija ja paikallinen ylläpitäjä. Kukaan agenteista ei saa korvata ihmisen Use Case-, Critic-, Refinement- tai external-write-päätöstä.
