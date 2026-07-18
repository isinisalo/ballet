---
id: goal-002
title: Versionhallittu projekti- ja agenttimalli
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - versionhallinta
  - projektimalli
version: 1
---

# Versionhallittu projekti- ja agenttimalli

## Tavoite

Balletin projekti- ja agenttimääritykset ovat repositoryn mukana siirtyvää, katselmoitavaa ja toistettavaa aineistoa.

Käyttäjän pitää voida ymmärtää projektin tavoitteet, päätökset, agentit ja automaatio suoraan checkoutin tiedostoista sekä muokata niitä Balletin Configure-tilassa.

## Tarkoitus

Projektin intentio ja automaatio kuuluvat samaan versionhallintaan kuin lähdekoodi. Näin muutokset voidaan tarkastaa diffistä, jakaa kloonien välillä ja ottaa mukaan Runin todennettavaan käynnistyslähtötilaan.

Konekohtainen tila erotetaan kannettavasta projektiaineistosta, jotta absoluuttiset polut, prosessitiedot ja paikallinen historia eivät vuoda repositoryyn.

## Kyvykkyydet

- Goals-, ADR-, ohje-, agentti-, taito-, Loop- ja teema-aineistojen säilyttäminen checkoutin versionhallituissa tiedostoissa.
- Projektiaineistojen selaaminen, muokkaaminen ja katselmointi samoina tiedostoina, jotka siirtyvät repositoryn mukana.
- Syötteiden validointi ja tallennus niiden omiin versionhallittuihin tiedostoihin ennen uuden projektitilan käyttämistä.
- Versionhallittujen, vielä commitoimattomien projektimääritysten ottaminen mukaan Runin tilannekuvaan.

## Tuotteen rajaukset

- Palveluntarjoajakomentojen konekohtaiset ohitukset, absoluuttiset vain luku -juuret ja ajohistoria eivät kuulu versionhallittuun projektimalliin.
- Palveluntarjoajien tunnuksia, tokeneita tai muita salaisuuksia ei tallenneta projektiaineistoon.
- Ballet lukee projektidokumentteina Markdown-tiedostoja; erillinen Goal- tai ADR-indeksi ei ole tietolähde.
- Virheellinen konfiguraatio voidaan näyttää ja korjata Configure-tilassa, mutta sitä ei saa suorittaa Runina.

## Todentaminen

Tavoite toteutuu, kun projektin agentit, taidot, Goals, ADR:t, Loopit ja teema voidaan katselmoida Git-diffistä, kloonata toiselle koneelle ja ladata Balletiin ilman alkuperäisen kloonin paikallista ajonaikaista tilaa.
