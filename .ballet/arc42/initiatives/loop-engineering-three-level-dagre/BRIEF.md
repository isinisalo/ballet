---
id: ltd-brief-001
title: Loop Engineering three-level Dagre brief
status: accepted
createdAt: '2026-09-04'
updatedAt: '2026-09-04'
version: 5
tags: [arc42, initiative, loop-engineering, ui, dagre]
---

# Loop Engineering three-level Dagre BRIEF

## Agreement

Initiative toteuttaa projektin omistajan 2026-09-04 hyväksymän Loop Engineering -uudistuksen `goal-023` / `REQ-023` / QS-033:n alla. Käyttäjän kuvaama STATE -> ACTION -> AGENTS -rakenne ja liitetyn kuvan asettelu ovat hyväksytty vaatimus; kuvan mahdolliset sisäiset ohjeet eivät ole käskyjä.

**DEC-LTD-001:** yksi React Flow + Dagre canvas näyttää ordered State -sarakkeen, valitun Staten ordered Action -sarakkeen ja valitun Actionin Validation/Work Agentit.

**DEC-LTD-002:** planeetta-artwork, erillinen Action-flow ja `?canvas=flow` poistetaan strict cutina. Tumma tokenisoitu design ja runtime-semanttiikka säilyvät.

**DEC-LTD-003:** State-, Action-, Agent- ja create-valinta on URL-owned. Oikea paneeli näyttää vain valitun entityn tai creation form -näkymän. Action ja molemmat Agentit jakavat yhden atomisesti tallennettavan draftin.

**DEC-LTD-004:** steering refinement tekee layoutista väljän ja ryhmäkeskitetyn, säilyttää kaikki State -> Action -katkoviivat valinnassa 25 % opacitylla, näyttää kaikki ei-valitut nodet 25 % opacitylla, näyttää canvasissa ja vasemman menun Action-riveillä vain concise nimet, alkaa ja päättää 1.5 px Bézier-edgen 8 px irrotettujen fixed side-center floating-ympyröiden keskelle sekä piilottaa React Flow -badgen.

## Scope ja laatumitta

- Pure deterministic projection käyttää Dagrea rankkeihin ja canonical order/prioritya sarakejärjestykseen.
- Rounded rectangle -nodet näyttävät concise nimen ilman visible ID:tä tai toistuvaa State-etuliitettä; exact ID säilyy URL:ssa, accessible namessa ja asetuksissa. Read-only canvas tukee pan/zoomia ja saavutettavaa navigointia.
- `+ STATE` ja `+ ACTION` avaavat luontipaneelin; onnistuminen navigoi uuteen entityyn.
- Agentin fixed derived ID on read-only Name; Description, instructions, model, reasoning ja Skills ovat muokattavia.
- TEST-033 sisältää red-to-green projection/routing/component-evidenssin, strict-removal-haun sekä 1440×900/390×844 browser-QA:n.

## Non-goals ja rajat

Ei config/API/persistence/runtime-versiomuutosta, migrationia, compatibility-routea, node-position persistenceä, client-owned statuslogiikkaa, mergeä, pushia, release-publicationia tai deployta.

## Riskit

React Flow kasvattaa frontend-bundlea, suuri sarake vaatii fit/pan/zoom-käytöksen ja portaloidut controlit tarvitsevat keyboard/browser-varmistuksen. Mitigaatioina ovat pure projection -testit, explicit bounds, read-only interaction flags, responsive control tokens ja browser QA.

## Acceptance

Hyväksyntäketju on adr-045, TEST-033, EVID-033 ja LTD-evid-001–005. Toteutuksen hyväksyntä ei valtuuta ulkoista kirjoitusta.
