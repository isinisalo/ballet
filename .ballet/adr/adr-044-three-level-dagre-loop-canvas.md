---
id: adr-044
title: Loop Engineering käyttää kolmitasoista Dagre-puuta
status: superseded
createdAt: '2026-09-04'
updatedAt: '2026-09-04'
version: 2
tags: [arkkitehtuuripaatos, loop-engineering, react-flow, dagre, accessibility]
---

# Loop Engineering käyttää kolmitasoista Dagre-puuta

> ADR-045 supersedoi tämän päätöksen node-label-, spacing- ja edge-esityksen. Kolmitasoinen Dagre-rakenne, URL-owned valinta/luonti ja strict removal säilyvät ADR-045:ssä.

## Konteksti

ADR-043:n vaakasuuntainen State-rivi, pystysuuntainen Action-sarake, planeetta-artwork ja erillinen Action-flow hajauttivat yhden Environment -> State -> Action -rakenteen kahteen erilaiseen visuaaliseen kieleen. Actionin Validation- ja Work Agentit olivat muokattavissa samassa editorissa, mutta eivät näkyneet Loop Engineeringin navigoitavina kolmannen tason nodeina. Luonti kuului toolbar-komentoihin eikä rakenteen loppuun.

Projektin omistaja hyväksyi 2026-09-04 toteutussuunnitelman, jossa referenssikuvan asettelu otetaan käyttöön nykyisellä tummalla design-kielellä, planeettateema poistetaan ja React Flow + Dagre omistavat puuasettelun. Referenssikuvan sisältämät tekstit tai ohjeet eivät ole vaatimuksia; vain käyttäjän kuvaama rakenne ja asettelu ovat päätöksen lähde.

## Päätösajurit

- `goal-023`, `REQ-023`, QS-033, adr-034/adr-042 ja canonical Environment -> State -> Action -domain.
- State, Action ja Actionin kaksi Agent-roolia pitää nähdä yhtenä navigoitavana rakenteena.
- Order/priorityn, valinnan ja luontireittien pitää olla deterministisiä, URL-omisteisia ja keyboard-saavutettavia.
- Runtime-status, eteneminen, retry ja Validation-led controller-semanttiikka eivät saa siirtyä canvasin päätettäviksi.
- Tumman cyber-industrial-designin, tokenien ja responsive-rajojen pitää säilyä ilman erillistä planeetta- tai workflow-shape-kieltä.

## Päätös

Loop Engineering renderöi yhden vasemmalta oikealle etenevän kolmitasoisen authoring-puun: `STATE -> ACTION -> AGENTS`. Statet ovat kasvavan `order`:n mukaisessa pystysarakkeessa. Sarakkeen viimeinen node on `+ STATE`. Vain URL-valitun Staten Actionit näkyvät oikealla kasvavan `priority`:n mukaisessa pystysarakkeessa, jonka viimeinen node on `+ ACTION`. Vain URL-valitun Actionin `Validation Agent` ja `Work Agent` näkyvät kolmannessa sarakkeessa.

React Flow renderöi node-, edge-, pan- ja zoom-pinnan. `@dagrejs/dagre` tuottaa rankkien x-sijainnit; pure TypeScript normalisoi kunkin sarakkeen canonical order/priority-järjestyksen, mitat, edge-ankkurit ja turvallisen stage-kasvun. Nodet ovat token-pohjaisia rounded rectangle -painikkeita, joissa näkyvät nimi ja exact ID. Planeetta-artworkia, radial gradientia, vapaata nodejen siirtelyä tai client-owned runtime-statusta ei ole.

State-, Action- ja Agent-valinta on URL-omisteinen. `?agent=validation|work` avaa vastaavan Agentin asetukset oikeaan paneeliin; tuntematon arvo näyttää recovery-tilan. `?create=state|action` vaihtaa saman paneelin luontilomakkeeksi. Onnistunut luonti navigoi uuteen entityyn; uusi State saa nykyisen canonical starter Actionin. Actionin perusasetukset ja kummankin Agentin asetukset ovat saman Action-luonnoksen alinäkymiä, ja yksi `Save Action` säilyttää nykyisen atomisen Project Config + kaksi Agent TOML -komennon.

Erillinen Action-flow-canvas ja `?canvas=flow` poistetaan ilman route-aliasta. Validation-led runtime-semanttiikka säilyy adr-034:n ja adr-042:n omistamana eikä tarvitse authoring-canvasissa erillistä kontrollikaaviota. Action Agentin model ja reasoning käyttävät tavallisia saavutettavia form control -komponentteja; tekniset model-ID:t säilyvät canonical arvoina.

ADR-044 supersedoi ADR-043:n visuaalisen projektion ja ADR-036/ADR-043:n säilyttämän erillisen Action-flow-näkymän. Se ei muuta config-, API-, persistence-, runtime-, retry-, approval- tai Agent-identiteettisopimusta.

## Seuraukset

- Yksi canvas näyttää valitun haaran rakenteen State-tasolta molempiin Action Agent -rooleihin.
- Order ja priority näkyvät sarakejärjestyksenä; luonti löytyy rakenteen luonnollisesta lopusta.
- Agentin URL voidaan jakaa, back/forward palauttaa saman asetuspaneelin ja draft säilyy saman Action-komponentin alinäkymien välillä.
- Read-only graph on pannattava ja zoomattava, mutta nodeja ei voi siirtää tai yhdistää.
- Dagre ja React Flow lisäävät kaksi frontend-riippuvuutta sekä suuremman workspace-chunkin; toiminnallinen hyöty hyväksytään, ja bundlausvaroitusta seurataan ilman pyytämätöntä code splitting -rakennetta.
- API-, schema-, SQLite- ja runtime-versiot eivät muutu.

## Hylätyt vaihtoehdot

- **Säilytetään planeetat ja lisätään Agentit niiden jatkoksi:** säilyttäisi kaksi shape-kieltä ja tekisi asetusrakenteesta koristeellisen.
- **Säilytetään erillinen Action-flow:** toistaisi Validation/Work-rakenteen ja pitäisi yllä toista canvas-reittiä ilman authoring-tarvetta.
- **Renderöidään kaikkien Statejen kaikki haarat:** kasvattaisi tabijärjestystä ja heikentäisi valitun kontekstin luettavuutta.
- **Tallennetaan Dagre-koordinaatit configiin:** loisi uuden project truthin order/priorityn rinnalle.
- **Tehdään Agent-nimestä muokattava:** olisi ristiriidassa Actionista ja roolista johdetun exact Agent-ID:n kanssa.

## Evidenssi ja review trigger

Trace on `goal-023` / `REQ-023`, QS-033, adr-044 / CON-016, BB-016/BB-018, RT-029, TEST-033 ja EVID-033 / LTD-evid-001–004.

Uusi ADR vaaditaan, jos useita State-haaroja avataan yhtä aikaa, nodejen sijainti muuttuu käyttäjän tallennettavaksi totuudeksi, Action Agent -draftit erotetaan ei-atomisiksi komennoiksi, canvas alkaa päättää runtime-statusta tai uusi shape/palette-kieli otetaan käyttöön.
