---
id: arc42-section-07
title: Käyttöönottonäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 8
tags: [arc42, deployment]
arc42Section: 7
---

# 7. Käyttöönottonäkymä

| ID | Ympäristö | Sijoitus ja raja |
| --- | --- | --- |
| DEP-005 | Local strict-v21 installation | checkout-kohtainen loopback server/UI, SQLite v17 `.git/ballet`-alueella sekä paritettu macOS-daemon, jonka managed Git checkoutissa Codex/Copilot CLI:t suoritetaan |
| DEP-006 | Paired strict-v21 installation | loopback control server/UI ja yksi valittu paritettu Computer/daemon per Run; SQLite v17 serverillä, daemon keychain-tokenilla, exact checkout/config preflight ja Codex/Copilot CLI backendit |

Release archive rakentuu canonical project-data- ja API-smokella. `make latest` asentaa paikallisen buildin ja käynnistää checkout-kohtaisen palvelun; se ei valtuuta julkaisua tai deployta. Epäyhteensopiva SQLite arkistoidaan tai poistetaan, ei muunnettu. Worktreet säilyvät auditia varten, kunnes niiden immutable commit/artifact-evidenssi ei enää tarvitse read accessia.
