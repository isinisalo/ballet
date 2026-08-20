---
id: adr-021
title: Workflow-canvas projisoi Validationin JobNoden sisään
status: accepted
createdAt: '2026-08-20T00:00:00.000Z'
updatedAt: '2026-08-20T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - workflow-engineering
  - ui
version: 1
---

# Workflow-canvas projisoi Validationin JobNoden sisään

## Konteksti

ADR-020 erotti strict-v12-domainissa JobNoden ja ValidationNoden, mutta sitoi myös canvas-projektion yksi yhteen domain-rakenteeseen: molemmat roolit saivat erillisen artworkin, kiinteät validate/retry-siirtymät omat viivansa ja PASS/FAIL omat endpoint-nodensa. Tämä lisäsi canvasille suoritusrakenteita, joita ei authoroida, ja rikkoi aiemman suojatun yhden planeetan avaruusmetaforan.

Projektin omistaja päätti 2026-08-20 eksplisiittisesti, että Workflow Engineering -canvasissa näkyvät vain JobNodet ja Edget. Validation on JobNoden sisäinen vastuu, PASS/FAIL eivät ole nodeja ja Edge-geometria saa olla vain straight tai smart smoothstep. Päätös on canvas-projektion rajaus, ei strict-v12-domainin tai runtimen palautus composite WorkLoopNode -malliin.

## Päätös

### Canvas-node

Workflow Engineering piirtää täsmälleen yhden planeettamaisen Job-artworkin jokaista `ProjectJobNodea` kohti.

- Paired `ProjectValidationNode` säilyy erillisenä domain-, execution-, outcome- ja editorientiteettinä.
- Validationin identiteetti, aktiivinen rooli, status ja reasoning glow projisoidaan omistavan Job-artworkin sisäiseksi saavutettavaksi tilaksi.
- ValidationNode ei ole erillinen canvas-node eikä erillinen canvas-valinta. Sen oma editori säilyy Job/Validation-määrittelylistan kautta.
- Jobin konfiguroitu artwork ja koko omistavat canvas-esityksen myös Validationin ollessa aktiivinen.

### Canvas-edget ja tulokset

Canvas piirtää vain persistoidut `ProjectPassEdge`- ja `ProjectFailEdge`-kokoelmat.

- Suoraan seuraavaan JobNodeen kulkeva PassEdge käyttää `straight`-geometriaa.
- Sykli, hyppy ei-viereiseen JobNodeen ja terminaalinen tulos käyttää deterministisesti reititettyä, pyöristettyä smart `smoothstep` -geometriaa.
- Workflow-canvasille ei lisätä Bézier-, freeform-, dashed-, dotted- tai muuta kolmatta Edge-geometriaa.
- PASS/FAIL ovat domain-tuloksia, eivät canvas-nodeja. Terminaalinen Edge päättyy kirkkaaseen yhteyspisteeseen ja icon-plus-text-labeliin ilman valittavaa endpointtia.
- Kiinteitä Job → Validation- ja Validation FAIL → paired Job -retry-siirtymiä ei piirretä Edgeinä. Ne säilyvät runtime-invariantteina.

### Visuaalinen vakaus

Tumma 24 px tekninen ruudukko, Job-planeettojen konfiguroidut tyylit ja koot, hehkut, amber-ID-labelit, ohuet semanttiset yhteydet ja kirkkaat yhteyspisteet säilyvät. Tämä päätös ei valtuuta avaruusteeman, tokenien tai muun shape-kielen vaihtamista.

## Supersession-raja

ADR-021 supersedoi vain ADR-020:n **UI ja authoring** -kohdan canvas-projektion, joka vaati erilliset Job/Validation-artworkit, validate/retry-polut ja PASS/FAIL-endpoint-nodet.

ADR-020:n seuraavat osat säilyvät:

- strict-v12 `ProjectWorkflow` ja erilliset Job/Validation-kokoelmat;
- 1:1-paritus, Pass/Fail Edge -kardinaliteetti ja reachability;
- Job/Validation-outcomet, retry/repair/continuation ja teknisen failure-tilan rajat;
- versiot, persistenssi, canonical reitit, atominen parin authorointi ja erilliset editorit;
- Graph-, State-, Orchestrator-, Loop Module- ja project/platform-invariantit.

Historiallista ADR-020-tiedostoa tai goal-013:a ei kirjoiteta uudelleen.

## Seuraukset

- Canvas palauttaa yhden selkeän planeetan per authoroitava työ säilyttäen Validationin tarkan runtime-totuuden.
- Kiinteitä runtime-siirtymiä ei voi tulkita vahingossa authoroitaviksi Edgeiksi.
- PASS/FAIL-semanttiikka säilyy tekstissä, ikonissa ja värissä ilman nodeiksi naamioituja tuloksia.
- Validationin itsenäinen muokkaus tapahtuu määrittelylistassa/editorissa, ei canvas-valinnalla.
- Edge-reitittimen hyväksyttävä geometriajoukko on pieni ja testattava.

## Hylätyt vaihtoehdot

### Domain-rakenteen suora yksi yhteen -piirto

Hylätty canvasilla, koska erillinen Validation-artwork ja kiinteät runtime-polut lisäävät authorointipintaan elementtejä, joita käyttäjä ei käsittele itsenäisenä topologiana.

### PASS/FAIL endpoint-nodeina

Hylätty, koska tuloksilla ei ole Node-identiteettiä, execution compositionia, schedulea tai inspector-vastuuta.

### Vapaat tai teemasta johdetut Edge-tyylit

Hylätty Workflow-canvasilla, koska useampi geometria heikentää determinismiä ja sekoittaa runtime-siirtymän persisted Edgeen.

## Evidenssi ja review trigger

Toteutus arvioidaan `QS-015` / `TEST-015` / `EVID-015` -ketjussa: canvas sisältää vain Job-artworkit, persisted Edget käyttävät vain `straight | smoothstep` -geometriaa, terminal result -nodeja sekä validate/retry-viivoja on nolla, ja desktop/narrow-selain-QA säilyttää avaruusteeman.

Päätös arvioidaan uudelleen ennen Validationin poistamista domainista/editorista, uuden authoroitavan Edge-lajin lisäämistä tai avaruusteeman olennaista muuttamista.
