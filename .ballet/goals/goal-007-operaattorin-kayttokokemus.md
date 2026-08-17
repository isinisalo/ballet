---
id: goal-007
title: Operaattorin käyttökokemus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-17T00:00:00.000Z'
tags:
  - tavoite
  - käyttökokemus
  - operaatiot
version: 3
---

# Operaattorin käyttökokemus

## Tavoite

Ballet tarjoaa tiiviin, teknisen ja rauhallisen operaatiotyötilan, jossa projektin konfiguraatio ja käynnissä olevien Work-, Validation- ja Orchestrator-suoritusten tila ovat nopeasti ymmärrettäviä.

Käyttäjän pitää pystyä siirtymään määrittelystä suoritukseen, löytämään korjattavat ongelmat ja seuraamaan aktiivista Runia ilman epäselviä tai päällekkäisiä käyttöliittymätiloja.

## Tarkoitus

Käyttöliittymä palvelee DevOps-asiantuntijoita, AI-arkkitehteja ja agenttioperaattoreita, jotka tarvitsevat korkean tietotiheyden mutta matalan tulkinnanvaraisuuden. Visuaalinen tyyli noudattaa `DESIGN.md`-tiedoston cyber-industrial-järjestelmää.

## Kyvykkyydet

- Yksi globaali Ballet-valinta Configure- ja Run-tilojen välillä.
- Goals-, ADR-, instruction-, skill- ja ExecutionProfile-aineistojen tiiviit kokoelmanäkymät sekä Loop Engineer ja suora yhden projektiteeman editori.
- Markdown-, ExecutionProfile-, Loop- ja teemaeditorit, joissa on näkyvä validointi ja yksiselitteinen tallennustila. ExecutionProfilejen runtime-valinnat muokataan erillään Node editorin nimetystä profile-valinnasta.
- Authoring-visualisointi, joka erottaa Context-, composition- ja selected-Loop detail -tasot sekä niiden `LoopEdge`- ja `Edge`-omistajuuden.
- Run mission control, jossa Mission, All Loops ja live inspector näyttävät immutable snapshotin, aktiivisen Work/Validation/Orchestrator-roolin, repair/return-reitin, State-revisionin ja finalisoinnin ilman keksittyä prosenttia tai ETA:a.
- Ajoympäristön valmiuden ja havaittujen ongelmien sekä saatavilla olevien kirjautumiskomentojen näyttäminen.
- Aktiivisten ja viimeaikaisten Runien, ihmisen hyväksyntäporttien, konsolin ja strukturoidun lopputuloksen näyttäminen.
- Yhdenmukaiset lataus-, tyhjä-, huomio-, virhe- ja estotilat.
- Työpöytä- ja kapeiden näkymien saavutettava käyttö sekä vähennetyn liikkeen asetus.

## Tuotteen rajaukset

- Käyttöliittymä on nykytilassa vain tumma; vaaleaa tai järjestelmäteemaa ei tarjota.
- Operaatiotilaa ei peitetä markkinointikielellä, koristeellisilla näkymillä tai epätarkoilla statuksilla.
- Configure- ja Run-vastuut pidetään erillään, eikä Loop- tai Work Loop Node -kohtaisia rinnakkaisia tilavalitsimia lisätä.
- Projektin Loop-teema vaikuttaa vain Loop-visualisointeihin, ei Balletin muuhun käyttöliittymään.

## Todentaminen

Tavoite toteutuu, kun käyttäjä löytää samasta navigaatiosta määriteltävän kohteen, näkee sen validoinnin, vaihtaa Work Loop Noden tai Loopin vastaavaan Run-kohteeseen ja ymmärtää Mission-/All Loops-/live inspector -näkymistä aktiivisen roolin, yrityksen, revisionin, repair/return-polun, odottavan päätöksen, virheen tai lopputuloksen ilman piilotettua tai keksittyä tilaa.
