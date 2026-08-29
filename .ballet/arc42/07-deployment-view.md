---
id: arc42-section-07
title: Käyttöönottonäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 6
tags: [arc42, deployment]
arc42Section: 7
---

# 7. Käyttöönottonäkymä

| ID | Ympäristö | Sijoitus ja raja |
| --- | --- | --- |
| DEP-005 | Local strict-v20 installation | yksi macOS-host, täsmällinen checkout, loopback server/UI, SQLite v16 `.git/ballet`-alueella, managed Git worktrees ja paikalliset provider CLI:t |

Release archive rakentuu canonical project-data- ja API-smokella. `make latest` asentaa paikallisen buildin ja käynnistää checkout-kohtaisen palvelun; se ei valtuuta julkaisua tai deployta. Epäyhteensopiva SQLite arkistoidaan tai poistetaan, ei muunnettu. Worktreet säilyvät auditia varten, kunnes niiden immutable commit/artifact-evidenssi ei enää tarvitse read accessia.
