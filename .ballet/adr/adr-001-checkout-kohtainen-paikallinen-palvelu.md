---
id: adr-001
title: Checkout-kohtainen paikallinen palvelu
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-29T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - paikallinen-palvelu
  - checkout
version: 2
---

# Checkout-kohtainen paikallinen palvelu

## Konteksti

Ballet tarvitsee projektin Agent-konfiguraatiota, selainkäyttöliittymää, ajastusta, control planea ja Run-tilaa yhdistävän ajonaikaisen ympäristön. Projektin luonnollinen omistusraja on paikallinen Git-checkout. Provider-suoritus voi tapahtua ihmisen parittamalla daemon-koneella ADR-035:n mukaisesti ilman jaettua pilviprojektirekisteriä.

## Päätös

Ballet toteutetaan checkout-kohtaisena paikallisena palveluna.

- `ballet` hyväksyy käynnistyspaikaksi vain Git-checkoutin tarkan juuren, jolla on HEAD-commit.
- Yksi checkout-kohtainen Node-prosessi palvelee käyttöliittymän ja paikallisen API/control-planen sekä ajaa ajastuksen ja Run-orkestroinnin.
- Prosessi kuuntelee vain osoitteessa `127.0.0.1` automaattisesti valitussa vapaassa portissa.
- Jokaiselle checkoutille luodaan polusta johdettu yksilöllinen launchd-työ, vakaa instanssitunnus ja oma paikallinen tila.
- Eri checkoutit ja saman repositoryn eri kloonit voivat toimia samanaikaisesti toisistaan riippumatta.
- Provider-adapterit ajetaan erillisessä paritetussa daemonissa. Control plane ylläpitää checkout-kohtaista laiterekisteriä, Agent-bindingeja ja leaseja ilman pilvitiliä tai keskitettyä moniprojektiohjausta.

## Seuraukset

- Kaikki käyttöliittymän ja API:n projektitoiminnot kohdistuvat aina palvelun omaan checkoutiin.
- CLI:n elinkaarikomennot ratkaisevat kohteen nykyisestä työhakemistosta eivätkä hallitse muita checkoutteja.
- Checkoutit voivat käyttää eri portteja, asetuksia, Runeja ja daemon-bindingeja ilman yhteistä tietokantaa.
- Paikallinen käyttöliittymä ja ajonaikainen tila eivät tarvitse Ballet-etäpalvelua; Codex- tai Copilot-suoritus voi silti tarvita verkkoyhteyden.
- Checkout-palvelun ja daemonin launchd-plistit, daemon-config ja OS-keychain-token ovat Git-hakemiston ulkopuolisia machine-local artefakteja.
- Nykyinen alustatuki ja launchd-elinkaari rajaavat tuotteen macOS:ään.

## Toteutuksen lähteet

- `README.md`
- `backend/cli/CheckoutState.ts`
- `backend/cli/LaunchdService.ts`
- `backend/project/ProjectContext.ts`
- `backend/server/createBalletServer.ts`
- `backend/control-plane/**`
- `backend/daemon/**`

ADR-035 supersedoi tämän päätöksen alkuperäisen pairing- ja remote-daemon-kiellon; checkout-kohtainen UI-, API- ja project truth -omistus säilyy.
