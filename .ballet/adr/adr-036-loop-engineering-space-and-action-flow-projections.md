---
id: adr-036
title: Loop Engineering yhdistää State- ja Action-projektiot avaruuscanvasiin
status: superseded
createdAt: '2026-08-29'
updatedAt: '2026-08-30'
version: 2
tags: [arkkitehtuuripaatos, loop-engineering, canvas, accessibility]
---

# Loop Engineering yhdistää State- ja Action-projektiot avaruuscanvasiin

> Superseded by [ADR-043](adr-043-compact-horizontal-state-canvas.md), joka säilyttää Action-flow- ja runtime-rajat mutta korvaa canvas-geometrian.

## Konteksti

Strict v21:n aktiivinen domain on Environment -> State -> Action, mutta Loop Engineeringin korttipohjainen Environment-, State- ja Action-authorointi hajotti järjestyksen ja valitun Actionin eri visuaalisiin pintoihin. Projektin omistaja pyysi 2026-08-29 palauttamaan versionhallinnan 15.7. avaruusilmeen nykyiselle domainille: entisiä ylhäältä alas järjestettyjä elementtejä vastaavat nyt Statet ja avatun Staten Actionit näkyvät samassa näkymässä planeettoina. Samalla Actionin flow pyydettiin palauttamaan selkeäksi workflow-projektioksi.

## Päätösajurit

- `goal-023`, `REQ-023`, QS-033 ja nykyiset adr-034/adr-035-domainrajat.
- Environment-, State- ja Action-reittien pitää säilyttää yksi spatiaalinen konteksti.
- Order ja priority ovat deterministisiä project-config-faktoja; runtime status ei kuulu authoring-canvasin päätettäväksi.
- Valinnan, deep linkin, back/forwardin, näppäimistön ja narrow-viewportin pitää toimia ilman rinnakkaista client truthia.
- Action-flow'n pitää kertoa Validationin controller-vastuu, Workin alisteisuus sekä done/retry/blocked-haarat muuttamatta runtimea.

## Päätös

Kaikki kolme canonical Loop Engineering -reittiä käyttävät samaa canvas + editor -shelliä. Canvas pysyy näkyvissä Environment-, State- ja Action-editorin rinnalla desktopissa ja niiden yläpuolella narrow-viewportissa.

- Statet projisoidaan kasvavan `order`:n mukaan ylhäältä alas mint-dashed-yhteydellä.
- Valitun Staten Actionit projisoidaan kasvavan `priority`:n mukaan vasemmalta oikealle samalla canvasilla. Muiden Statejen Actioneita ei avata yhtä aikaa.
- State- ja Action-solmut ovat oikeita vähintään 44 px:n reittipainikkeita. URL omistaa valinnan; State avaa canonical State -reitin ja paljastaa sen Actionit, Action avaa canonical Action -reitin ja editorin.
- Action-artwork on järjestyksestä johdettu, tallentamaton ulkoasu: ensimmäinen Action on aurinko, viimeinen asema ja niiden väliset Actionit planeettoja. Yhden Actionin State käyttää aurinkoa. Ulkoasu ei ilmaise runtime-statusta tai domain-tyyppiä.
- Pure TypeScript -projektio omistaa järjestyksen, koordinaatit, reunat, canvas-koon ja artwork-valinnan. React renderöi ja välittää navigoinnin.
- Canvas käyttää DESIGN-tokenien tummia pintoja, 24 px teknistä gridiä, mint-yhteyksiä, amber-label-kieltä ja blue-selectionia. Planeettojen token-pohjainen varjostus on rajattu poikkeus aiempaan koristeellisen avaruusgrafiikan kieltoon.
- Sisäinen vaakavieritys kuuluu canvasiin. Sivutason vaakaylivuoto on kielletty 1440x900- ja 390x844-acceptancessa.

Action-editorin workflow on deterministinen authoring-projektio: `START -> Validation -> done?`, josta `done` johtaa Staten etenemisporttiin ja `delegate/retry` Work-päätökseen. Work palaa evidenssin kanssa Validationiin; semantic retry palaa Workiin, exhaustion/blocked johtaa eksplisiittiseen `Blocked / Feedback` -terminaaliin. `1 + maxRetries` näytetään tekstinä. Kaavio ei ole runtime-ohjain eikä luo tilaa.

## Seuraukset

- Loop Engineering säilyttää orientationin route-siirtymissä ja tekee Environment -> State -> Action -hierarkian skannattavaksi yhdellä pinnalla.
- Laaja Action-jono tai narrow-viewport vaatii tarkoituksellisen sisäisen vaakavierityksen.
- Järjestyksestä johdettu artwork on visuaalinen sanasto; Actionin siirto voi siksi muuttaa sen artworkia ilman config-kenttää.
- API-, project config-, runtime-, persistence-, retry- ja approval-sopimukset eivät muutu.
- Historiallista domainia tai route-aliasta ei palauteta; vain nykyiset State- ja Action-ID:t näkyvät.

## Hylätyt vaihtoehdot

- **Erillinen canvas vain State-reitillä:** hukkaisi kontekstin Action-editoriin siirryttäessä.
- **Kaikkien Statejen Actionit yhtä aikaa:** kasvattaisi tiheän canvasin vaikeasti luettavaksi ja tekisi tabijärjestyksestä raskaan.
- **Artwork config-kenttänä:** laajentaisi v21-sopimusta ilman domain-tarvetta.
- **Flow runtime-controlina:** rikkoisi serverin ja SQLite-runtime-statuksen omistajuuden.
- **Vapaa pan/zoom-topologia:** heikentäisi determinismiä, keyboard-lukujärjestystä ja narrow-layoutin todennettavuutta.

## Evidenssi ja review trigger

Trace on `goal-023` / `REQ-023`, QS-033, `adr-035` ja `adr-036` / CON-016, BB-016, RT-029, TEST-033, EVID-033 sekä initiative `loop-engineering-space-and-action-flow`.

Uusi ADR vaaditaan, jos artworkista tehdään tallennettua domain-dataa, useita Stateja avataan yhtä aikaa, canvas alkaa projisoida tai mutatoida runtime-statusta, canonical reitit muuttuvat tai Action-flow'n controller/retry-semanttiikka muuttuu.
