---
id: adr-003
title: Yhteinen TypeScript-sovellusarkkitehtuuri
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - typescript
  - sovellusrakenne
version: 1
---

# Yhteinen TypeScript-sovellusarkkitehtuuri

## Konteksti

Balletin käyttöliittymä, paikallinen API, ajoaikaiset sopimukset ja tallennetut tilat muodostavat yhden paikallisen tuotteen. Käyttöliittymän ja palvelimen mallien eriytyminen aiheuttaisi erityisen riskin Loop-, Run- ja palveluntarjoajatilojen validoinnissa.

## Päätös

Ballet toteutetaan yhtenä Node.js- ja TypeScript-sovelluksena, jonka vastuut jaetaan `frontend`, `backend` ja `shared` -alueisiin.

- Frontend on React 18- ja Vite 6 -pohjainen SPA.
- Käyttöliittymä käyttää Tailwind CSS 4:ää sekä shadcn/Base UI -primitiivejä `DESIGN.md`-tiedoston suunnittelusopimuksen sisällä.
- Loop-visualisointi käyttää XYFlow'ta, Dagrea ja smart-edge-reititystä.
- Backend on Express 4 -palvelin, joka koostaa HTTP-rajat, dokumenttipalvelut, ajastuksen, Run-orkestroinnin ja palveluntarjoajasovittimet samaan prosessiin.
- `shared/domain` omistaa kanoniset domain-tyypit ja `shared/api` jaetut API-sopimukset sekä pääosan Zod-skeemoista. Reittikohtaiset skeemat voivat jäädä HTTP-koostumusrajalle.
- Paikallinen persistenssi käyttää `better-sqlite3`-kirjastoa.
- Yksikkö- ja komponenttitestit käyttävät Vitestiä, Testing Librarya ja jsdomia; staattinen analyysi käyttää ESLintiä.

## Seuraukset

- Frontend ja backend jakavat Runien, ajoympäristön, automaation ja työtilan sopimustyypit.
- HTTP-pyyntöjen rungot ja reittiparametrit validoidaan niille määritellyillä skeemoilla ennen niiden siirtämistä sovelluspalveluihin.
- Tuotantokoonti sisältää käännetyn Node-palvelimen ja staattisen käyttöliittymäkoonnin.
- Natiivi `better-sqlite3`-riippuvuus on rakennettava ja käynnistystestattava erikseen jokaiselle tuetulle macOS-arkkitehtuurille.
- Tuotekohtaiset UI-komponentit koostetaan yhteisten käyttöliittymäprimitiivien päälle, eikä ominaisuuskoodi luo rinnakkaista design-järjestelmää.
- Erillinen frontend-palvelin, SSR-kehys tai toinen palvelimen ajoympäristö edellyttää uutta arkkitehtuuripäätöstä.

## Toteutuksen lähteet

- `package.json`
- `vite.config.ts`
- `shared/domain/`
- `shared/api/`
- `backend/server/createBalletServer.ts`
