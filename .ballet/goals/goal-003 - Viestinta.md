---
id: goal-003
status: accepted
title: Viestintä
created_date: '2026-06-07 12:35'
updated_date: '2026-06-23'
tags:
  - intent
  - goal
  - notifications
version: 1
---
# Viestintä

## GOAL

Tarjoa palvelun sisäinen viestintäkyvykkyys käyttäjälle tarkoitettujen viestien muodostamiseen, kirjaamiseen ja toimitustilan näyttämiseen.

Viestintä tukee esimerkiksi sähköpostivahvistusta, salasanan palautusta ja muita käyttäjälle näkyviä palveluviestejä ilman, että jokainen tuotealue ratkaisee viestien muodostamista ja tilaseurantaa erikseen.

## INTENT

Viestinnän tulee tehdä käyttäjälle lähetettävistä tai näytettävistä viesteistä jäljitettäviä. Viestin pyytäjän pitää voida tietää, että viesti muodostettiin hyväksytystä sisällöstä, toimitusta yritettiin hallitusti ja toimituksen tila voidaan näyttää oikealle osapuolelle.

Viestintä ei saa vuotaa viestien salaisuuksia, palautuslinkkejä, vahvistussalaisuuksia tai tarpeetonta vastaanottajatietoa.

## CAPABILITIES

- Käyttäjälle tarkoitetun viestipyynnön vastaanottaminen palvelun muilta osilta.
- Viestin muodostaminen hyväksytystä sisällöstä ja hyväksytyistä muuttujista.
- Toimitusyrityksen, tuloksen ja käyttäjälle turvallisen toimitustilan kirjaaminen.
- Toimitustilan näyttäminen rajatusti käyttäjälle, hallinnalle tai viestin pyytäneelle palvelun osalle.
- Epäonnistuneen toimituksen esittäminen niin, että käyttäjä saa hyödyllisen tilan ilman raw-virheen tai salaisuuden paljastumista.

## EVIDENCE

Tavoite täyttyy, kun käyttäjälle tarkoitettu viesti voidaan muodostaa hyväksytystä sisällöstä, toimitusyritys kirjata ja toimitustila näyttää ilman arkaluonteisen tiedon vuotoa.
