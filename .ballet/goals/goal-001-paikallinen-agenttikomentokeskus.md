---
id: goal-001
title: Paikallinen agenttikomentokeskus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - tavoite
  - paikallinen-käyttö
  - komentokeskus
version: 2
---

# Paikallinen agenttikomentokeskus

## Tavoite

Ballet tarjoaa yhden Git-checkoutin paikallisen selainkäyttöisen komentokeskuksen projektimääritysten, automatisoinnin, Step-suoritusten ja seurannan hallintaan.

Käyttäjän pitää voida käynnistää Ballet checkoutin juuresta ja hallita saman projektikontekstin Goals- ja ADR-dokumentteja, Looppeja, Stepejä, ExecutionProfileja, instructioneita, skillsejä, ajoympäristön valmiutta ja Runeja yhdestä käyttöliittymästä.

## Tarkoitus

Ballet kokoaa projektin Step-työn yhteen paikalliseen prosessiin, jotta konfiguraatio, suorituksen lähtötila ja lopputulos pysyvät ymmärrettävinä. Checkout on tuotteen ensisijainen omistus- ja eristysraja.

Paikallinen malli pitää käyttäjän lähdekoodin, palveluntarjoajien tunnukset ja ajonaikaisen tilan käyttäjän omalla koneella ilman keskitettyä ohjaustasoa.

## Kyvykkyydet

- Git-checkoutin juuren ja olemassa olevan HEAD-commitin tarkistaminen ennen palvelun käynnistystä.
- Configure-tila versionhallittujen projektiaineistojen muokkaamiseen.
- Run-tila Looppien ja niiden Step-suoritusten käynnistämiseen, seuraamiseen, ohjaamiseen ja peruuttamiseen.
- Paikallisten Codex- ja Copilot-palveluntarjoajien valmiuden ja havaittujen ongelmien näyttäminen.
- Useiden checkoutien samanaikainen käyttö toisistaan eristetyillä palveluilla, porteilla ja tiloilla.
- Checkout-kohtainen käyttöliittymä, ajastus, suoritusjono, kestävä tallennus ja Git-työtila samassa paikallisessa palvelussa.

## Tuotteen rajaukset

- Yksi Ballet-palvelu hallitsee vain yhtä tarkkaa Git-checkoutia.
- Tuotteessa ei ole käyttäjätilejä, paritusprosessia, etädaemonia, laiterekisteriä eikä keskitettyä moniprojektiohjausta.
- Ballet ei hallitse palveluntarjoajien tunnuksia eikä siirrä niitä omaan tietovarastoonsa.
- Ballet ei yhdistä Run-branchia eikä lähetä sitä etärepositoryyn automaattisesti.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi käynnistää Balletin commitoidun checkoutin juuresta, avata paikallisen käyttöliittymän, määrittää Loopin ja sen Step-suoritukset sekä suorittaa työn ilman tiliä tai ulkoista Ballet-palvelua. Toinen checkout voi toimia samanaikaisesti vaikuttamatta ensimmäisen tilaan.
