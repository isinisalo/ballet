---
id: goal-005
title: Turvallinen ja toistettava Git-suoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - git
  - turvallisuus
version: 1
---

# Turvallinen ja toistettava Git-suoritus

## Tavoite

Jokainen Balletin Root Run aloitetaan rajatussa Git-työtilassa tiivisteellä todennetusta käynnistyslähtötilasta.

Käyttäjän aktiivinen checkout ei saa muuttua agenttisuorituksen sivuvaikutuksena, ja jokaisen onnistuneen tai epäonnistuneen Runin tuloksen pitää olla tarkastettavissa.

## Tarkoitus

Git-eristys suojaa käyttäjän työtilaa ja tekee monivaiheisestä agenttityöstä jäljitettävää. Ennakkotarkistus ja tilannekuva sitovat suorituksen lähdekoodiin, projektimääritykseen ja ajoaikaisiin valintoihin, jotka olivat voimassa Runin alussa.

## Kyvykkyydet

- Git-tilan ja todennettavan käynnistyslähtötilan tarkistaminen ennen Runia.
- Root Runin suorittaminen omalla branchilla eristetyssä Git-worktreessä.
- Sallittujen commitoimattomien projektimääritysten ottaminen mukaan Runin tiivisteellä sidottuun käynnistyslähtötilaan.
- Saman Root Runin Steppien suorittaminen järjestyksessä samassa worktreessä.
- Kirjoitusoikeuden rajaaminen Root Runin worktreehen.
- Onnistuneen Root Runin muutosten commitointi ja onnistuneen worktreen siivoaminen.
- Epäonnistuneen, estetyn, perutun tai keskeytyneen Root Runin worktreen säilyttäminen tutkintaa varten.

## Tuotteen rajaukset

- Likaiset lähdekoodimuutokset estävät Runin käynnistyksen.
- Ballet ei kirjoita agentin muutoksia käyttäjän aktiiviseen checkoutiin.
- Ballet ei yhdistä Run-branchia eikä lähetä sitä etärepositoryyn automaattisesti.
- Kirjoittaminen worktreen ulkopuolelle sekä tuntemattomat käyttöoikeuspyynnöt estetään.
- Verkko on pois käytöstä, ellei se ole sallittu eksplisiittisesti agentin kannettavassa intentiossa.

## Todentaminen

Tavoite toteutuu, kun Runin aikana syntyvät muutokset näkyvät vain sen omassa worktreessä, onnistunut tulos raportoi commit-SHA:n ja luo uuden commitin silloin kun muutoksia on, ja epäonnistunut tulos voidaan tutkia säilytetystä worktreestä ilman aktiivisen checkoutin muutosta.
