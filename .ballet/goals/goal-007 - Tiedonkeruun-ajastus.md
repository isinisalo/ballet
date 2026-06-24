---
id: goal-007
status: accepted
title: Tiedonkeruun ajastus
created_date: '2026-06-07 12:36'
updated_date: '2026-06-23'
tags:
  - intent
  - goal
  - scheduling
version: 1
---
# Tiedonkeruun ajastus

## GOAL

Tarjoa hallittu ajastuskyvykkyys yrityskohtaiselle tiedonkeruulle.

Käyttäjän tai ylläpidon pitää voida määrittää kuinka usein seurattavan yrityksen EODHD-markkinadata ja Inderes Forum -keskusteluaineisto haetaan. Palvelun pitää näyttää milloin keruu viimeksi onnistui tai epäonnistui, mitä lähdettä keruu koski ja milloin seuraava keruu erääntyy.

## INTENT

Tiedonkeruun ajastus tekee yrityskohtaisista keruista toistettavia, seurattavia ja käyttäjälle ymmärrettäviä. Se ei päätä miten EODHD-markkinadata tai Inderes Forum -aineisto tulkitaan, vaan huolehtii siitä, että hyväksytyt keruut käynnistyvät oikeaan aikaan ja niiden tila näkyy.

Kun keruu epäonnistuu, käyttäjän ja ylläpidon pitää nähdä turvallinen tilatieto ilman raw-virhettä, salaisuuksia tai päällekkäisten keruiden aiheuttamaa epäselvyyttä.

## CAPABILITIES

- Yrityskohtaisen EODHD-markkinadatakeruun tiheyden ja seuraavan erääntymisen määrittäminen.
- Yrityskohtaisen Inderes Forum -keskustelukeruun tiheyden ja seuraavan erääntymisen määrittäminen.
- Erääntyneen keruun käynnistäminen hallitusti ilman hallitsemattomia päällekkäisiä ajoja.
- Keruun lähteen, käynnistysajan, lopputuloksen, viimeisimmän onnistumisen, viimeisimmän epäonnistumisen ja seuraavan tilan tallennus.
- Tilapäisesti epäonnistuneen keruun uudelleenkäsittely hyväksyttyjen rajojen sisällä.
- Pysyvästi epäonnistuneen tai käyttäjän huomiota vaativan keruun näyttäminen erillisenä tilana.

## EVIDENCE

Tavoite täyttyy, kun seurattavalle yritykselle voidaan asettaa EODHD- ja Inderes Forum -keruiden tiheys, erääntynyt keruu käynnistyy hallitusti, lopputulos kirjataan onnistuneeksi tai epäonnistuneeksi ja käyttäjä näkee viimeisimmän keruun sekä seuraavan erääntymisen ilman hallitsemattomia päällekkäisiä keruita.
