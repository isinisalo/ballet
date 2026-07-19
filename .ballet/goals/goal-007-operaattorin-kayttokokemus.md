---
id: goal-007
title: Operaattorin käyttökokemus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - tavoite
  - käyttökokemus
  - operaatiot
version: 2
---

# Operaattorin käyttökokemus

## Tavoite

Ballet tarjoaa tiiviin, teknisen ja rauhallisen operaatiotyötilan, jossa projektin konfiguraatio ja käynnissä olevien Step-suoritusten tila ovat nopeasti ymmärrettäviä.

Käyttäjän pitää pystyä siirtymään määrittelystä suoritukseen, löytämään korjattavat ongelmat ja seuraamaan aktiivista Runia ilman epäselviä tai päällekkäisiä käyttöliittymätiloja.

## Tarkoitus

Käyttöliittymä palvelee DevOps-asiantuntijoita, AI-arkkitehteja ja agenttioperaattoreita, jotka tarvitsevat korkean tietotiheyden mutta matalan tulkinnanvaraisuuden. Visuaalinen tyyli noudattaa `DESIGN.md`-tiedoston cyber-industrial-järjestelmää.

## Kyvykkyydet

- Yksi globaali Ballet-valinta Configure- ja Run-tilojen välillä.
- Goals-, ADR-, instruction-, skill-, ExecutionProfile- ja All Loops -aineistojen tiiviit kokoelmanäkymät sekä suora yhden projektiteeman editori.
- Markdown-, ExecutionProfile-, Loop- ja teemaeditorit, joissa on näkyvä validointi ja yksiselitteinen tallennustila. ExecutionProfilejen runtime-valinnat muokataan erillään Node editorin nimetystä profile-valinnasta.
- Loop-visualisointi, joka näyttää nodet, Transitionit, terminaalit, aktiivisen vaiheen ja Run-tilannekuvan.
- Ajoympäristön valmiuden ja havaittujen ongelmien sekä saatavilla olevien kirjautumiskomentojen näyttäminen.
- Aktiivisten ja viimeaikaisten Runien, ihmisen hyväksyntäporttien, konsolin ja strukturoidun lopputuloksen näyttäminen.
- Yhdenmukaiset lataus-, tyhjä-, huomio-, virhe- ja estotilat.
- Työpöytä- ja kapeiden näkymien saavutettava käyttö sekä vähennetyn liikkeen asetus.

## Tuotteen rajaukset

- Käyttöliittymä on nykytilassa vain tumma; vaaleaa tai järjestelmäteemaa ei tarjota.
- Operaatiotilaa ei peitetä markkinointikielellä, koristeellisilla näkymillä tai epätarkoilla statuksilla.
- Configure- ja Run-vastuut pidetään erillään, eikä Loop- tai Step-kohtaisia rinnakkaisia tilavalitsimia lisätä.
- Projektin Loop-teema vaikuttaa vain Loop-visualisointeihin, ei Balletin muuhun käyttöliittymään.

## Todentaminen

Tavoite toteutuu, kun käyttäjä löytää samasta navigaatiosta määriteltävän kohteen, näkee sen validoinnin, vaihtaa Stepin tai Loopin vastaavaan Run-kohteeseen ja ymmärtää aktiivisen vaiheen, odottavan päätöksen, virheen tai lopputuloksen ilman piilotettua tilaa.
