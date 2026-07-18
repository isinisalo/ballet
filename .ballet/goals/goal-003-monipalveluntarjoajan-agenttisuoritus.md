---
id: goal-003
title: Usean palveluntarjoajan paikallinen agenttisuoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - agenttisuoritus
  - palveluntarjoajat
version: 1
---

# Usean palveluntarjoajan paikallinen agenttisuoritus

## Tavoite

Ballet suorittaa Codex- ja Copilot-agentteja samalla paikallisella toimintamallilla säilyttäen palveluntarjoajakohtaiset ominaisuudet ja valmiustiedot näkyvinä.

Käyttäjän pitää valita agentille eksplisiittisesti palveluntarjoaja, malli, reasoning effort ja verkkointentio sekä nähdä ennen Runia, voidaanko valittu yhdistelmä suorittaa.

## Tarkoitus

Yhteinen suorituskokemus estää automaatiota sitoutumasta yhden palveluntarjoajan tapahtuma- tai tulosmuotoon. Eksplisiittinen ajoaikainen määritys tekee Runin lähtökohdista toistettavia eikä peitä valintoja oletusten taakse.

## Kyvykkyydet

- Codex CLI:n ja GitHub Copilot CLI:n asennuksen, version, autentikoinnin ja kyvykkyyksien tarkistaminen.
- Palveluntarjoaja-, malli-, reasoning effort- ja verkkovalinnan tallentaminen agenttikohtaisesti.
- Konekohtaisten vain luku -juurien yhdistäminen kannettavaan agentti-intentioon.
- Palveluntarjoajasta riippumattomien tehtävätilojen, konsolitapahtumien ja strukturoitujen lopputulosten näyttäminen.
- Saman palveluntarjoajan ajojen hallittu eteneminen ja eri palveluntarjoajien ajojen mahdollinen rinnakkaisuus.
- Asennus-, autentikointi- ja yhteensopivuusongelmien selkeä näyttäminen ennen Runia.

## Tuotteen rajaukset

- Ballet ei valitse palveluntarjoajaa, mallia tai reasoning effortia automaattisella varavalinnalla.
- Autentikointi tulee palveluntarjoajan CLI:stä tai sen tukemasta ympäristöstä; Ballet ei pyydä eikä tallenna palveluntarjoajan tunnuksia.
- Tuettu suoritusympäristö on nykyisen checkoutin paikallinen macOS-isäntä; erillistä konevalintaa ei ole.
- Palveluntarjoajan raakaa tapahtumamuotoa tai piilotettua reasoning-sisältöä ei näytetä sellaisenaan käyttöliittymässä.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi määrittää kaksi agenttia eri palveluntarjoajille, nähdä kummankin todellisen valmiuden, käynnistää ajot ja tarkastella niiden tilaa sekä lopputulosta saman Run-kokemuksen kautta ilman implisiittistä palveluntarjoajan vaihtoa.
