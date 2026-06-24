---
id: adr-007
title: frontend-laadunvarmistus ja testit
date: '2026-06-06'
status: accepted
---
## Context
Frontend tarvitsee staattisen analyysin, yksikkötestit ja selainpohjaiset testit käyttäjän näkyville päävirroille.

## Decision
ESLint valitaan frontendin lint-työkaluksi, Jest yksikkötesteihin ja Playwright end-to-end- sekä käyttöliittymätestaukseen. Playwright-testit kirjoitetaan Given/When/Then-rakenteella ja Page Object -mallilla.

## Consequences

- Frontend-koodin tulee läpäistä ESLint ennen yhdistämistä.
- Jest-testit rajataan ensisijaisesti eristettyyn logiikkaan, validointiin ja pieniin komponentteihin.
- Käyttäjän näkyvät korkean arvon virrat testataan Playwrightilla.
- Playwright-testit sijoitetaan `frontend/tests/e2e/`-hakemistoon ja Page Objectit `frontend/tests/e2e/pages/`-hakemistoon.
- Testirungossa kuvataan käyttäjän tarkoitus, ei selector-tason toteutusta.
- Sama käyttäytyminen ei saa toistua tarpeettomasti useassa testitasossa.
