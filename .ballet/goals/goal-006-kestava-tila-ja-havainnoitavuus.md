---
id: goal-006
title: Kestävä tila, palautuminen ja havainnoitavuus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - jatkuvuus
  - havainnoitavuus
version: 1
---

# Kestävä tila, palautuminen ja havainnoitavuus

## Tavoite

Ballet säilyttää Runien, Steppien, suoritustehtävien, tapahtumien ja ajastusten tilan paikallisesti niin, että operaattori ymmärtää, mitä tapahtui myös prosessin uudelleenkäynnistyksen jälkeen.

Aktiivisen työn, ihmisen vastausta odottavan vaiheen, finalisoinnin ja päättyneen Runin tilan pitää olla yksiselitteisesti havaittavissa.

## Tarkoitus

Kestävä tila estää agenttityön katoamisen prosessin elinkaaren mukana. Eksplisiittinen palautumismalli erottaa turvallisesti jatkettavan jonotyön sellaisesta kesken jääneestä työstä, jota ei saa suorittaa uudelleen hiljaisesti.

## Kyvykkyydet

- Root Run-, Loop Run-, Step Run-, suoritustehtävä-, tapahtuma- ja ajastustilan paikallinen tallennus.
- Jonossa olevan työn säilyttäminen odottamattoman palvelukatkoksen yli.
- Kesken olleen suorituksen merkitseminen keskeytyneenä epäonnistuneeksi käynnistyksen yhteydessä.
- Runin peruuttaminen sekä jonossa olevien ja käynnissä olevien tehtävien hallittu lopettaminen.
- Aktiivisten ja viimeaikaisten Runien, nykyisen Stepin ja finalisoinnin tuloksen näyttäminen.
- Palveluntarjoajasta riippumattoman, yhteyskatkon jälkeen jatkettavan konsolitapahtumavirran näyttäminen.
- Ajastuksen edellisen esiintymän, seuraavan suoritusajan ja ohitetun ajon syyn säilyttäminen.
- Konsolisisällön katkaisutilan näyttäminen säilytysrajan täyttyessä.

## Tuotteen rajaukset

- Ajonaikainen tila kuuluu nykyiseen klooniin eikä muodosta checkoutien yhteistä historiaa.
- Keskeytynyttä käynnissä ollutta tehtävää ei ajeta automaattisesti uudelleen.
- Konsoli näyttää palveluntarjoajan julkaisemat tapahtumat ja reasoning-yhteenvedot, ei piilotettua päättelyketjua.
- Ei-terminaalisen konsolisisällön säilytys on rajattu yhteen mebitavuun tehtävää kohti; terminaalitapahtumat säilyvät.

## Todentaminen

Tavoite toteutuu, kun odottamattoman katkoksen yli säilynyt jonotettu työ jatkuu palvelun seuraavassa käynnistyksessä, kesken jäänyt työ näkyy eksplisiittisenä epäonnistumisena ja käyttäjä pystyy jäljittämään Runin vaiheet, tapahtumat, lopputuloksen ja finalisoinnin paikallisesta historiasta.
