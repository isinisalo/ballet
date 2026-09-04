---
id: adr-043
title: Loop Engineering käyttää tiivistä vaakasuuntaista State-projektiota
status: superseded
createdAt: '2026-08-30'
updatedAt: '2026-09-04'
version: 2
tags: [arkkitehtuuripaatos, loop-engineering, canvas, accessibility]
---

# Loop Engineering käyttää tiivistä vaakasuuntaista State-projektiota

> Superseded by [ADR-044](adr-044-three-level-dagre-loop-canvas.md), joka korvaa canvas-geometrian, planeetta-artworkin ja erillisen Action-flow-näkymän kolmitasoisella Dagre-puulla.

## Konteksti

ADR-036:n ylhäältä alas etenevä State-projektio ja oikealle avautuva Action-rivi tekivät 1440×900-työtilan 590 px leveästä canvas-osasta tarpeettoman väljän pystysuunnassa ja erittäin leveän Actionien määrän kasvaessa. Balletin canonical viiden Staten aineistossa Arc42n 12 Actionia kasvattivat sisäisen stagen 2520 px leveäksi. Lisäksi State-node toisti `STATE n`-, name- ja id-tekstin, vaikka exact id yksin riittää authoring-projektion tunnisteeksi.

Projektin omistaja pyysi 2026-08-30 Statet vasemmalta oikealle, valitun Staten Actionit ylhäältä alas sen alle, pienemmät nodet, lyhyemmät edget ja nykyisen desktop-aineiston ilman canvas-scrollia. Toteutuspyyntö hyväksyy tämän päätöksen eksplisiittisesti.

## Päätösajurit

- `goal-023`, `REQ-023`, QS-033, adr-034/adr-042 sekä nykyinen Environment -> State -> Action -domain.
- Canonical orderin ja priorityn pitää säilyä deterministisinä ja URL-valinnan omistamina.
- Nykyisten viiden Staten ja enintään 12 Actionin pitää mahtua 1440×900-canvaspintaan ilman sisäistä scrollia.
- Narrow-viewportin ja rajattomasti kasvavan project configin pitää säilyä saavutettavana sisäisen scrollin avulla ilman sivutason overflowta.
- Pienempi visuaalinen artwork ei saa pienentää reittipainikkeiden 44 px osuma-aluetta.

## Päätös

Loop Engineering projisoi Statet kasvavan `order`:n mukaan yhteen tiiviiseen vaakariviin. State-node näyttää näkyvästi vain exact `state.id`:n; `name` säilyy accessible name -tekstissä. Vain URL-valitun Staten Actionit projisoidaan kasvavan `priority`:n mukaan pystysarakkeeksi saman x-ankkurin alle. Muiden Statejen Actionit eivät avaudu yhtä aikaa.

Pure TypeScript omistaa nodejen 96×44 px State-footprintin, 44×44 px Action-hitboxin, pienemmät order-derived Action-artworkit, kompaktit välit, reuna-ankkuroidut edget ja stage-mitat. React renderöi projektion ja välittää canonical navigoinnin. Stage täyttää mitatun pinnan; se kasvaa vain, kun State- tai Action-määrä ei mahdu turvallisiin vähimmäismittoihin. 390×844 ja suuremmat aineistot saavat vierittää canvasin sisällä, mutta sivutason vaakaylivuoto on edelleen kielletty.

ADR-036:n Validation-led Action-flow, artworkin tallentamattomuus, authoring-only-semanttiikka, canonical reitit ja runtime-statuksen serveriomistus säilyvät muuttumattomina. Tämä ADR supersedoi ADR-036:n kokonaisuutena ja restatoi nämä säilyvät rajat yhdessä uuden canvas-geometrian kanssa.

## Seuraukset

- Canonical 5 State / 12 Action -aineisto mahtuu 1440×900:n mitattuun canvaspintaan ilman sisäistä pysty- tai vaakavieritystä.
- Statet ja Actionit ovat skannattavissa kahdella ortogonaalisella order-kielellä: State vasemmalta oikealle, Action ylhäältä alas.
- Exact State ID ei kilpaile nimen tai johdetun order-labelin kanssa; accessible name säilyttää kuvaavan nimen screen readerille.
- Pitkä config ei pienennä interaktiivisia kohteita rajatta, vaan kasvattaa deterministic stagea ja käyttää sisäistä scrollia.
- API-, project config-, persistence-, runtime-, retry- ja approval-sopimukset eivät muutu.

## Hylätyt vaihtoehdot

- **Yksi Action-vaakarivi Staten alla:** säilyttäisi 12 Actionin leveysongelman.
- **Kaikkien Statejen Actionit yhtä aikaa:** kasvattaisi tabijärjestystä ja rikkoisi selected-State-only-rajauksen.
- **Osuma-alueen pienentäminen artworkin mukana:** heikentäisi keyboard/touch-saavutettavuutta.
- **Pakotettu no-scroll kaikilla datamäärillä ja narrow-viewportissa:** vaatisi rajatonta pienennystä tai sisällön leikkaamista.

## Evidenssi ja review trigger

Trace on `goal-023` / `REQ-023`, QS-033, adr-043 / CON-016, BB-016, RT-029, TEST-033 ja EVID-033 / LESAF-evid-008.

Uusi ADR vaaditaan, jos useita Stateja avataan yhtä aikaa, order/priority ei enää määrää geometriaa, layout muuttuu käyttäjän vapaasti siirreltäväksi, reittipainikkeet alittavat 44 px tai canvas alkaa projisoida tai mutatoida runtime-statusta.
