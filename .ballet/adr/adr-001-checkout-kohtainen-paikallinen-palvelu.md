---
id: adr-001
title: Checkout-kohtainen paikallinen palvelu
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - paikallinen-palvelu
  - checkout
version: 1
---

# Checkout-kohtainen paikallinen palvelu

## Konteksti

Ballet tarvitsee projektin agenttikonfiguraatiota, selainkäyttöliittymää, ajastusta, suoritusjonoa, palveluntarjoajasovittimia ja Run-tilaa yhdistävän ajonaikaisen ympäristön. Projektin luonnollinen omistusraja on paikallinen Git-checkout, eikä käyttö edellytä etäpalvelua tai jaettua projektirekisteriä.

## Päätös

Ballet toteutetaan checkout-kohtaisena paikallisena palveluna.

- `ballet` hyväksyy käynnistyspaikaksi vain Git-checkoutin tarkan juuren, jolla on HEAD-commit.
- Yksi Node-prosessi palvelee käyttöliittymän ja paikallisen API:n sekä ajaa ajastuksen, suoritusjonon, palveluntarjoajasovittimet ja Run-orkestroinnin.
- Prosessi kuuntelee vain osoitteessa `127.0.0.1` automaattisesti valitussa vapaassa portissa.
- Jokaiselle checkoutille luodaan polusta johdettu yksilöllinen launchd-työ, vakaa instanssitunnus ja oma paikallinen tila.
- Eri checkoutit ja saman repositoryn eri kloonit voivat toimia samanaikaisesti toisistaan riippumatta.
- Arkkitehtuuriin ei kuulu käyttäjätilejä, paritusta, etädaemonia, laiterekisteriä eikä keskitettyä ohjaustasoa.

## Seuraukset

- Kaikki käyttöliittymän ja API:n projektitoiminnot kohdistuvat aina palvelun omaan checkoutiin.
- CLI:n elinkaarikomennot ratkaisevat kohteen nykyisestä työhakemistosta eivätkä hallitse muita checkoutteja.
- Checkoutit voivat käyttää eri portteja, asetuksia, Runeja ja palveluntarjoajakomentoja ilman yhteistä tietokantaa.
- Paikallinen käyttöliittymä ja ajonaikainen tila eivät tarvitse Ballet-etäpalvelua; Codex- tai Copilot-suoritus voi silti tarvita verkkoyhteyden.
- Checkoutin launchd-plist on ainoa Balletin projektikohtainen artefakti Git-hakemiston ulkopuolella.
- Nykyinen alustatuki ja launchd-elinkaari rajaavat tuotteen macOS:ään.

## Toteutuksen lähteet

- `README.md`
- `backend/cli/CheckoutState.ts`
- `backend/cli/LaunchdService.ts`
- `backend/project/ProjectContext.ts`
- `backend/server/createBalletServer.ts`
