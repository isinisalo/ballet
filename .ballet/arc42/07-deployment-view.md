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
| DEP-005 | Historical local installation | supersedoitu local server/daemon -deployment ennen checkout-local strict cutia |
| DEP-006 | Historical paired installation | supersedoitu paired Computer/control-plane -deployment ilman aktiivista toteutusta |
| DEP-007 | Checkout-local strict-v23 installation | yksi checkout-kohtainen loopback server/UI, SQLite v21 ja yksi saman checkoutin launchd-daemon; random 0600 bearer-token, polling ja vain Codex CLI, ei pairingia, provider/network/root-valintoja tai remote checkoutia |

Release archive rakentuu canonical project-data- ja API-smokella. `make latest` asentaa paikallisen buildin ja `ballet start` käynnistää sekä serverin että checkout-daemonin ja odottaa niiden healthia; se ei valtuuta julkaisua tai deployta. Epäyhteensopiva SQLite/control-plane-state arkistoidaan tai poistetaan, ei muunnettu. Worktreet ovat serverin omistamia ja säilyvät auditia varten, kunnes immutable evidenssi ei enää tarvitse read accessia.
