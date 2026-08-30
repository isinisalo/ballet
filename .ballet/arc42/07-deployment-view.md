---
id: arc42-section-07
title: Käyttöönottonäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-30'
version: 11
tags: [arc42, deployment]
arc42Section: 7
---

# 7. Käyttöönottonäkymä

| ID | Ympäristö | Sijoitus ja raja |
| --- | --- | --- |
| DEP-005 | Local strict-v21 installation | checkout-kohtainen loopback server/UI, SQLite v17 `.git/ballet`-alueella sekä paritettu macOS-daemon, jonka managed Git checkoutissa Codex/Copilot CLI:t suoritetaan |
| DEP-006 | Paired strict-v21 installation | loopback control server/UI ja yksi valittu paritettu Computer/daemon per Run; SQLite v17 serverillä, daemon keychain-tokenilla, exact checkout/config preflight ja Codex/Copilot CLI backendit |
| DEP-007 | Checkout-local strict-v22 installation | yksi checkout-kohtainen loopback server/UI, SQLite v20 ja yksi saman checkoutin launchd-daemon; random 0600 bearer-token, polling sekä Codex/Copilot CLI:t, ei pairingia tai remote checkoutia |

Release archive rakentuu canonical project-data- ja API-smokella. `make latest` asentaa paikallisen buildin ja `ballet start` käynnistää sekä serverin että checkout-daemonin ja odottaa niiden healthia; se ei valtuuta julkaisua tai deployta. Epäyhteensopiva SQLite/control-plane-state arkistoidaan tai poistetaan, ei muunnettu. Worktreet ovat serverin omistamia ja säilyvät auditia varten, kunnes immutable evidenssi ei enää tarvitse read accessia.
