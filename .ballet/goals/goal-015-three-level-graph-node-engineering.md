---
id: goal-015
title: Kolmitasoinen Graph Node Engineering ja agenttiohjattu reititys
status: accepted
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-22T00:00:00.000Z'
tags:
  - tavoite
  - graph-engineering
  - graph-node
  - orchestrator
version: 1
---

# Kolmitasoinen Graph Node Engineering ja agenttiohjattu reititys

## Tavoite

Ballet korvaa aktiivisen Loop/Workflow-mallin strict hard cutilla kolmitasoiseen `Graph → GraphNode → JobNode` -rakenteeseen. Operaattori näkee saman rakenteen kolmella canonical URL -reitillä, ja Graph- sekä Graph Node -orchestratorit tekevät kaikki tasojen väliset reitityspäätökset immutable snapshotin strict candidate-enumista.

Job Node säilyttää kaksi kiinteää sisäistä invarianttia: Work valmistuu Validationiin ja Validation FAIL palaa retry-rajan sisällä Workiin. Muut dispatchit, terminaalit, repairit ja eskalaatiot kuuluvat oikean tason orchestratorille.

## Käyttäjäarvo

- Graph Engineering näyttää kokonaisuuden, globaalin orchestratorin, valinnaisen Repair Noden ja GraphNode-planeetat ilman alemman tason nodeja.
- Graph Node näyttää yhden Graph Noden JobNode-planeetat, paikallisen orchestratorin ja valinnaisen Repair Noden ilman vieraan scopin nodeja.
- Job Node näyttää erilliset Work- ja Validation-planeetat, validate/retry-yhteydet ja PASS/FAIL-terminalit.
- Suora drill-down, breadcrumb sekä browser back/forward tekevät kolmen tason rakenteesta ymmärrettävän ilman rinnakkaista hybridi- tai compatibility-näkymää.
- Orchestratorit käyttävät Balletin oletusdatassa kustannusherkkää Luna/medium/network-off-profiilia. Vaikeampi repair käyttää Sol/medium/network-off-profiilia ennen ihmiseskalaatiota. Platform ei hardkoodaa kumpaakaan mallia.

## Domain- ja suoritusrakenne

`ProjectConfiguration.graph` omistaa yhteisen Staten, Graph Orchestratorin, valinnaisen Repair Noden ja 1–40 `ProjectGraphNodea`. Jokainen Graph Node omistaa oman orchestratorinsa, valinnaisen Repair Noden ja 1–64 black-box `ProjectJobNodea`. Job Node omistaa täsmälleen yhden Work Noden ja yhden Validation Noden, joten orphan- tai shared-Validation-tilaa ei voi muodostaa.

Orchestrator saa vain snapshotatun tilanteeseen sopivan target-enumin. Virheellinen target tai kelpaamaton `needs_input` voidaan yrittää enintään kolme kertaa, minkä jälkeen saman tason Repair Node saa korjata Staten tai Run-worktreen artefakteja, valita sallitun repair-dispatchin tai eskaloida. Graph Repair Noden jälkeen viimeinen raja on ihmisen `needs_input`. Repair ei laajenna immutable snapshotin target-joukkoa tai oikeuksia ja palaa durable LIFO-framella samaan Validationiin.

## Hard cut

Koordinoitu raja on project config v14, Graph Node Module v4, Root Snapshot v7, Task Envelope/outcome v7, composition v8, ExecutionSpec v9 ja SQLite schema v10. Aktiivisesta domainista, API:sta, UI:sta, moduleista ja reiteistä poistuvat Loop-, Workflow-, schedule-, transition-edge- ja repair-edge-rakenteet. Vanhat lukijat, aliakset, dual-write ja runtime-migraatio poistetaan; v9-kanta jää koskemattomaksi ja käynnistys epäonnistuu täsmällisellä archive/remediation-ohjeella.

## Rajaukset

- GraphNode Run voi käyttää ylempää Graph Orchestratoria vain repair-eskalaatioon eikä jatka normaaliin Graph-flow'hun.
- Standalone JobNode Runia tai schedulointia ei lisätä.
- Provider- tai mallifallbackia ei ole; profile/instruction-mapping on aina näkyvä ja preflight tarkistaa saatavuuden.
- Repair saa ehdottaa tulevan Runin route-konfiguraatiomuutosta mutta ei mutatoida aktiivista snapshotia.
- Release, deploy, rollback, merge, push, oikeuksien laajennus ja muu ulkoinen kirjoitus vaativat erillisen ihmisvaltuutuksen.

## Todentaminen

Tavoite on toteutunut, kun `QS-019` / `TEST-019` / `EVID-019` todentaa strict-v14-domainin, snapshotatun Luna/Sol-compositionin, agenttireitityksen, repair/return/restart/cancel-rajat, SQLite v10:n ja kaikkien 14 Graph Node Module v4 -paketin roundtripin. `QS-020` / `TEST-020` / `EVID-020` todentaa kolme canonical routea, scopen, keyboard/a11y:n, inspectorit, deterministic multi-ring-layoutin sekä desktop/narrow-viewportien avaruusteeman ilman overlapia, vaakaylivuotoa tai leikattua ydintoimintoa. Ihmisen visual verdict säilyy erillisenä acceptance-rajana.
