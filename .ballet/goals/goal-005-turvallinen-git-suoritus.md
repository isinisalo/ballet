---
id: goal-005
title: Turvallinen ja toistettava Git-suoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - tavoite
  - git
  - turvallisuus
version: 2
---

# Turvallinen ja toistettava Git-suoritus

## Tavoite

Jokainen Balletin Root Run aloitetaan rajatussa Git-työtilassa tiivisteellä todennetusta lähdekoodin ja projektimääritysten käynnistyslähtötilasta.

Käyttäjän aktiivinen checkout ei saa muuttua Step-suorituksen sivuvaikutuksena, ja jokaisen onnistuneen tai epäonnistuneen Runin tuloksen pitää olla tarkastettavissa.

## Tarkoitus

Git-eristys suojaa käyttäjän työtilaa ja tekee monivaiheisestä Step-työstä jäljitettävää. Atominen tilannekuva sitoo koko Root Runin lähdekoodiin, saavutettavaan workflow'hun ja suoritusvalintoihin, jotka olivat voimassa Runin alussa.

## Kyvykkyydet

- Git-tilan ja todennettavan käynnistyslähtötilan tarkistaminen ennen Runia.
- Root Runin suorittaminen omalla branchilla eristetyssä Git-worktreessä.
- Kaikkien Root Runista saavutettavien Looppien, Steppien, Transitionien, ExecutionProfilejen, instructionien, skillsien ja teeman atominen snapshottaaminen Runin alussa.
- Sallittujen commitoimattomien projektimääritysten ottaminen mukaan Runin tiivisteellä sidottuun käynnistyslähtötilaan.
- Saman Root Runin Steppien suorittaminen järjestyksessä samassa worktreessä.
- Kirjoitusoikeuden rajaaminen Root Runin worktreehen.
- Onnistuneen Root Runin muutosten commitointi ja onnistuneen worktreen siivoaminen.
- Epäonnistuneen, estetyn, perutun tai keskeytyneen Root Runin worktreen säilyttäminen tutkintaa varten.

## Tuotteen rajaukset

- Likaiset lähdekoodimuutokset estävät Runin käynnistyksen.
- Ballet ei kirjoita Step-suorituksen muutoksia käyttäjän aktiiviseen checkoutiin.
- Ballet ei yhdistä Run-branchia eikä lähetä sitä etärepositoryyn automaattisesti.
- Kirjoittaminen worktreen ulkopuolelle sekä tuntemattomat käyttöoikeuspyynnöt estetään.
- Verkko on pois käytöstä, ellei sitä ole sallittu eksplisiittisesti Stepin ExecutionProfilessa.
- Root Runin worktreessä tehdyt konfiguraatiomuutokset eivät muuta käynnissä olevan Runin tilannekuvaa, vaan vaikuttavat vasta seuraavaan Root Runiin.

## Todentaminen

Tavoite toteutuu, kun koko Root Run käyttää alussa atomisesti tallennettua tilannekuvaa myöhemmistä worktree-muutoksista riippumatta, Runin muutokset näkyvät vain sen omassa worktreessä ja onnistunut tulos raportoi commit-SHA:n. Epäonnistunut tulos voidaan tutkia säilytetystä worktreestä ilman aktiivisen checkoutin muutosta.
