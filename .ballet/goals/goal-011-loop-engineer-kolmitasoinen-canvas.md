---
id: goal-011
title: Kolmitasoinen Loop Engineer -työtila
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - tavoite
  - loop-engineer
  - kayttokokemus
version: 1
---

# Kolmitasoinen Loop Engineer -työtila

## Tavoite

Balletin käyttäjä ymmärtää Loop-järjestelmän projektitavoitteen, Looppien välisen koostumuksen ja yhden Loopin sisäisen toteutuksen ilman, että eri tarkkuustasojen nodet tai Edget sekoittuvat samaan näkymään.

Loop Engineer tarjoaa URL-ohjatut Context-, Level 1 · Loops- ja Level 2 · Detail -tasot. Käyttäjä voi lisätä valmiin yhden Loopin moduulin suoraan Level 1:ltä ja avata materialisoidun project-local Loopin sisäisen graafin Level 2:ssa.

## Tarkoitus

Hierarkkinen black box / white box -esitys tekee projektin Loop-topologiasta nopeasti ymmärrettävän ja säilyttää samalla yksittäisen Work Loop Noden Work/Validation-komposition tarkassa editorissa. Selkeä Edge-omistajuus vähentää riskiä, että project-global Loop Edgeä muokataan vahingossa yhden Loopin sisäisenä yhteytenä tai päinvastoin.

## Kyvykkyydet

- Read-only Context-projektio nykyisestä projektista, Loop-graafista, module-provenancesta ja saatavilla olevasta Run-tilasta.
- Level 1 -composition canvas, jossa yksi black box -node vastaa yhtä `ProjectLoop`ia ja yksi näkyvä yhteys yhtä `ProjectLoopEdgeä`.
- Level 2 -detail canvas, jossa näkyvät vain valitun Loopin `ProjectWorkLoopNode`-nodet, `ProjectNodeEdge`-yhteydet ja terminaalit.
- Keskitetty tyypitetty URL-reititys, yksiselitteinen level navigation, breadcrumb ja selainhistorian tuki.
- Loop Library-, import- ja blank-authoring-polku Level 1:ltä sekä onnistuneen installin authoritative workspace refresh.
- Näppäimistö- ja narrow viewport -käytettävyys kaikilla kolmella tasolla.

## Rajaukset

- Context ja levelit ovat authoring UI -projektioita, eivät runtime-entiteettejä tai sisäkkäisiä Loopeja.
- Project configuration pysyy strict v10:nä.
- Work ja Validation säilyvät yhtenä composite Work Loop Node -canvas-nodena.
- Loop Module pysyy yhden Loopin authoring/install-time artifactina; runtime ei tunne packagea tai UI-tasoa.
- `recommendedConnections` ei materialisoidu project-global yhteydeksi ilman käyttäjän eksplisiittistä muokkausta.

## Todentaminen

Tavoite toteutuu, kun puhtaat projektio- ja reititystestit osoittavat tasojen datarajat, UI-testit osoittavat level navigationin ja Edge-omistajuuden, module-testit osoittavat software-delivery starterien yhden Loopin sopimuksen ja selainkuvat osoittavat desktop- ja narrow viewport -käytettävyyden ilman tasojen sekoittumista.
