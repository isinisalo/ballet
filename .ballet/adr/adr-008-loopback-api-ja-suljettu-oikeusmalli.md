---
id: adr-008
title: Loopback-rajattu API ja oletuksena suljettu oikeusmalli
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - paikallinen-api
  - oikeusmalli
version: 1
---

# Loopback-rajattu API ja oletuksena suljettu oikeusmalli

## Konteksti

Balletin selainkäyttöliittymä muokkaa repositorytiedostoja ja käynnistää paikallisia agenttiprosesseja. Palvelu ei käytä käyttäjätilejä tai API-tokeneita, joten sen verkkoraja, selainpyyntöjen alkuperä ja agenttien käyttöoikeudet on rajattava eksplisiittisesti.

## Päätös

Paikallinen HTTP-API ja agenttien suorituspolitiikka toteutetaan oletuksena suljettuina rajoina.

- Palvelin sitoutuu osoitteeseen `127.0.0.1` ja hyväksyy vain loopback-Host-arvot.
- Palvelin ei myönnä CORS-käyttöä.
- Selainmutaatioiden Origin saa olla vain palvelun oma `127.0.0.1`- tai `localhost`-origin, ja `Sec-Fetch-Site` saa olla vain `same-origin` tai `none`.
- Originittomat loopback-pyynnöt hyväksytään paikallisten komentorivityökalujen mahdollistamiseksi; palvelin ei tunnista tai rajaa niitä tiettyyn asiakastyyppiin.
- Skeemoihin sidottujen API-reittien pyyntörungot, parametrit ja kyselyt validoidaan rajoilla tiukoilla Zod-skeemoilla. Konsolin SSE-kohdistin ja `Last-Event-ID` muunnetaan virrankäsittelijässä numeroiksi.
- Työtilan ja Runien päivityssignaalit sekä tehtäväkohtainen konsoli välitetään kohdistimella jatkettavina SSE-virtoina.
- Palveluntarjoajaprosessit eivät saa Balletin palvelutunnuksia tai paikallisen API:n erityisoikeuksia.
- Agentin luku sallitaan Root Runin worktreessä ja eksplisiittisissä vain luku -juurissa.
- Kirjoitus ja komennon työhakemisto sallitaan vain Root Runin worktreessä.
- Verkko sallitaan vain agentin eksplisiittisen verkkointention perusteella.
- MCP- ja tuntemattomat käyttöoikeuspyynnöt estetään; komennot, joissa on vaarallisia shell-rakenteita, erikseen estolistattuja absoluuttisia järjestelmäpolkuja tai oikeuksien laajennuksia, estetään.
- Ennakkotarkistus sitoo ExecutionSpecin palveluntarjoajan CLI-versioon, malliin, reasoning-valintaan, käyttöoikeuskyvykkyyksiin, HEADiin ja konfiguraatiotiivisteeseen.

## Seuraukset

- Balletin API ei ole tarkoitettu lähiverkosta tai internetistä käytettäväksi.
- Turvallisuusraja perustuu loopbackiin, paikalliseen käyttäjätiliin, selain-Originin tarkistukseen ja prosessikohtaiseen käyttöoikeuspolitiikkaan, ei Ballet-käyttäjäautentikointiin.
- Selain-Originin tarkistus ei estä originittomia loopback-pyyntöjä, eikä palvelin erottele niissä CLI:tä muista paikallisista asiakkaista.
- Agentti ei voi kesken Runin laajentaa verkkopääsyä, lukujuuria tai kirjoitusaluetta tallennetun politiikan ulkopuolelle.
- Palveluntarjoajan muuttunut CLI-versio tai kyvykkyystiiviste sekä mallin tai reasoning-valinnan poistuminen estävät jonotetun tehtävän suorittamisen vanhalla ajoympäristötilannekuvalla.
- Verkkopolitiikan komentotarkistus on puolustava lisäraja eikä korvaa palveluntarjoajan omaa eristysmallia.

## Toteutuksen lähteet

- `backend/server/createBalletServer.ts`
- `backend/http/apiRouter.ts`
- `backend/http/validation/httpValidation.ts`
- `backend/execution/WorkspacePermissionPolicy.ts`
- `backend/runs/LoopExecutionSnapshot.ts`
