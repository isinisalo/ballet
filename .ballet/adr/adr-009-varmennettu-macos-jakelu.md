---
id: adr-009
title: Varmennettu macOS-jakelu ja atominen päivitys
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - macos
  - jakelu
version: 1
---

# Varmennettu macOS-jakelu ja atominen päivitys

## Konteksti

Ballet tarvitsee Node-ajoympäristön, natiivin `better-sqlite3`-kirjaston, käännetyn palvelimen, käyttöliittymän ja CLI-käynnistimen. Julkaisun pitää toimia ilman käyttäjän omaa Node-asennusta, vastata koneen arkkitehtuuria ja olla varmennettavissa ennen aktiivisen version vaihtamista.

## Päätös

Ballet julkaistaan itsenäisinä, natiivisti rakennettuina ja varmennettuina macOS-paketteina.

- Git-tagin `v*` julkaiseminen käynnistää GitHub Actions -julkaisun.
- arm64- ja x64-arkistot rakennetaan niiden omissa natiiveissa macOS-ajoympäristöissä; arkkitehtuurien välinen ristiinrakennus estetään.
- Arkisto sisältää käynnistinskriptin, paketoidun Node-ajoympäristön, käännetyn palvelimen ja CLI:n, tuotantoriippuvuudet sekä käyttöliittymäkoonnin.
- Koonti lataa paketoidun `better-sqlite3`-kirjaston ja ajaa julkaisun käynnistystestin commitoidussa testicheckoutissa.
- Käynnistystesti tarkistaa checkout-tietoisen terveystarkistusvastauksen, `.git/ballet/state.sqlite`-tiedoston syntymisen, puhtaan Git-tilan ja hallitun pysäytyksen.
- Julkaisu tuottaa arkkitehtuuriarkistot, `checksums.txt`-tiedoston, Homebrew-formulan ja GitHub Artifact Attestation -todisteet.
- Varmennettu curl-asennus ja `ballet update` tarkistavat SHA-256:n sekä attestoinnin ennen aktivointia.
- Suora asennus säilyttää paketit muuttumattomissa versiohakemistoissa ja vaihtaa aktiivisen `<prefix>/bin/ballet`-symlinkin saman tiedostojärjestelmän atomisella uudelleennimeämisellä.
- Homebrew käyttää samaa julkaisuarkistoa ja hoitaa päivityksen omalla versionoidulla Cellar-mallillaan.

## Seuraukset

- Käyttäjän ei tarvitse asentaa erillistä Node-ajoympäristöä Balletin julkaistua versiota varten.
- Natiivit riippuvuudet testataan samoina tavuina, jotka julkaistaan ja aktivoidaan.
- Väärä arkkitehtuuri tai tarkistussumman epäonnistuminen estää asennuksen. Attestoinnin epäonnistuminen estää varmennetun curl-asennuksen ja suoran päivityksen.
- Käynnissä oleva prosessi voi jatkaa vanhasta versionoidusta paketista samalla, kun uudet käynnistykset käyttävät atomisesti aktivoitua versiota.
- Homebrew- ja varmennettu curl-polku edellyttävät julkaistua GitHub-julkaisua; kehityscheckout asennetaan erillisellä paikallisella koonti- ja asennuspolulla.
- Julkaisun onnistuminen riippuu GitHub Actions -oikeuksista, GitHub Artifact Attestation -varmennuksesta ja Homebrew-tapin julkaisuoikeudesta.

## Toteutuksen lähteet

- `.github/workflows/release.yml`
- `scripts/build-release.sh`
- `scripts/install.sh`
- `backend/cli/VerifiedReleaseUpdater.ts`
- `packaging/README.md`
