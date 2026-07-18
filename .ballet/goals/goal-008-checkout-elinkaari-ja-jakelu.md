---
id: goal-008
title: Checkout-kohtainen elinkaari ja luotettava jakelu
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - elinkaari
  - jakelu
version: 1
---

# Checkout-kohtainen elinkaari ja luotettava jakelu

## Tavoite

Ballet voidaan asentaa, käynnistää, tarkistaa, päivittää ja pysäyttää macOS:ssa tavalla, joka säilyttää checkoutien eristyksen ja julkaistujen pakettien eheyden.

Käyttäjän pitää voida hallita juuri nykyisen checkoutin palvelua selkeillä CLI-komennoilla sekä nähdä sen tila ja lokit ilman globaalia Ballet-hallintapalvelua.

## Tarkoitus

Checkout-kohtainen elinkaari tekee rinnakkaisten projektien paikallisesta käytöstä ennustettavaa. Varmennettu jakelu estää puutteellisen tai väärälle arkkitehtuurille rakennetun paketin aktivoimisen.

## Kyvykkyydet

- Nykyisen lähdekoodin julkaisupaketin rakentaminen, käynnistystestaus ja paikallinen asennus.
- Julkaistun Ballet-version asennus Homebrew-asennuksena tai varmennetulla curl-asentimella.
- CLI-komennot `ballet`, `stop`, `restart`, `status`, `logs`, `update` ja `version`.
- Checkoutille yksilöllisen launchd-työn, palveluidentiteetin ja vapaan loopback-portin hallinta.
- macOS arm64- ja x64-arkkitehtuureille rakennetut itsenäiset paketit.
- Suoran curl-asennuksen ja suoran `ballet update` -päivityksen SHA-256-tarkistus sekä GitHub Artifact Attestation -varmennus ennen aktivointia.
- Homebrew-asennuksen julkaisuarkiston tarkistaminen formulaan lukitulla SHA-256-arvolla ja päivittäminen Homebrew-asennuksen omalla elinkaarimallilla.
- Versionoidun paketin atominen aktivointi ja Homebrew-asennuksen oma päivityspolku.
- Kaikkien Balletin tarvitsemien ajoaikaisten osien toimittaminen yhdessä itsenäisessä paketissa.

## Tuotteen rajaukset

- Tuettu käyttöjärjestelmä on macOS ja tuetut arkkitehtuurit ovat arm64 ja x64.
- Homebrew- ja curl-asennus edellyttävät julkaistua GitHub-julkaisua; julkaisematon checkout asennetaan lähdekoodista.
- Elinkaarikomennot kohdistuvat nykyiseen checkoutiin; keskitettyä kaikkien projektien valvontanäkymää ei ole.
- Palveluntarjoajien asennus ja autentikointi jäävät niiden omien työkalujen ja tukemien ympäristömekanismien vastuulle.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi asentaa oikean arkkitehtuurin varmennetun paketin, käynnistää kaksi checkoutia rinnakkain, tarkistaa kummankin palvelun erikseen ja päivittää Balletin menettämättä checkout-kohtaista paikallista tilaa.
