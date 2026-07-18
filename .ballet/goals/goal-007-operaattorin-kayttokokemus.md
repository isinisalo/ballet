---
id: goal-007
title: Operaattorin käyttökokemus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - käyttökokemus
  - operaatiot
version: 1
---

# Operaattorin käyttökokemus

## Tavoite

Ballet tarjoaa tiiviin, teknisen ja rauhallisen operaatiotyötilan, jossa projektin konfiguraatio ja käynnissä olevan agenttityön tila ovat nopeasti ymmärrettäviä.

Käyttäjän pitää pystyä siirtymään määrittelystä suoritukseen, löytämään korjattavat ongelmat ja seuraamaan aktiivista Runia ilman epäselviä tai päällekkäisiä käyttöliittymätiloja.

## Tarkoitus

Käyttöliittymä palvelee DevOps-asiantuntijoita, AI-arkkitehteja ja agenttioperaattoreita, jotka tarvitsevat korkean tietotiheyden mutta matalan tulkinnanvaraisuuden. Visuaalinen tyyli noudattaa `DESIGN.md`-tiedoston cyber-industrial-järjestelmää.

## Kyvykkyydet

- Yksi globaali Ballet-valinta Configure- ja Run-tilojen välillä.
- Goals-, ADR-, ohje-, agentti-, taito- ja All Loops -aineistojen tiiviit kokoelmanäkymät sekä suora yhden projektiteeman editori.
- Markdown-, TOML-, Loop- ja teemaeditorit, joissa on näkyvä validointi ja eksplisiittinen tallennus. Agent Execution -konfiguraation automaattinen tallennus näytetään erillisenä toimintatapana.
- Loop-visualisointi, joka näyttää nodet, Transitionit, terminaalit, aktiivisen vaiheen ja Run-tilannekuvan.
- Ajoympäristön valmiuden ja havaittujen ongelmien sekä saatavilla olevien kirjautumiskomentojen näyttäminen.
- Aktiivisten ja viimeaikaisten Runien, ihmisen hyväksyntäporttien, konsolin ja strukturoidun lopputuloksen näyttäminen.
- Yhdenmukaiset lataus-, tyhjä-, huomio-, virhe- ja estotilat.
- Työpöytä- ja kapeiden näkymien saavutettava käyttö sekä vähennetyn liikkeen asetus.

## Tuotteen rajaukset

- Käyttöliittymä on nykytilassa vain tumma; vaaleaa tai järjestelmäteemaa ei tarjota.
- Operaatiotilaa ei peitetä markkinointikielellä, koristeellisilla näkymillä tai epätarkoilla statuksilla.
- Configure- ja Run-vastuut pidetään erillään, eikä Loop- tai agenttikohtaisia rinnakkaisia tilavalitsimia lisätä.
- Projektin Loop-teema vaikuttaa vain Loop-visualisointeihin, ei Balletin muuhun käyttöliittymään.

## Todentaminen

Tavoite toteutuu, kun käyttäjä löytää samasta navigaatiosta määriteltävän kohteen, näkee sen validoinnin, vaihtaa agentin tai Loopin vastaavaan Run-kohteeseen ja ymmärtää aktiivisen vaiheen, odottavan päätöksen, virheen tai lopputuloksen ilman piilotettua tilaa.
