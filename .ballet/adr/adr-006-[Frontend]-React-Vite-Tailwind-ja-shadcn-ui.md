---
id: adr-006
title: React, Vite, Tailwind CSS ja shadcn/ui
created_date: '2026-06-06 07:19'
updated_date: '2026-06-23 07:19'
status: accepted
---
## Context
Frontend tarvitsee komponenttipohjaisen käyttöliittymäkehyksen, kevyen SPA-build-työkalun sekä yhtenäisen tavan toteuttaa tyylit, teema ja peruskomponentit.

## Decision
Frontend toteutetaan Vite-pohjaisena React TypeScript SPA -sovelluksena. Tailwind CSS valitaan tyylijärjestelmäksi ja shadcn/ui UI-komponenttien pohjaksi presetillä `bcivVKZU`.

## Consequences

- Frontendin tuotantobuild tuottaa staattisen selainasiakkaan, joka voidaan julkaista CloudFrontin kautta.
- UI toteutetaan React-komponentteina, joissa esitysrakenne ja sovelluslogiikka pidetään erillään.
- Tyylien tulee käyttää semanttisia teematokeneita raakavärien sijaan.
- Jaettavat UI-komponentit sijoitetaan yhteiseen frontend-komponenttialueeseen.
- Uudet UI-kirjastot, server-side rendering, Next.js tai erillinen frontend-palvelin vaativat uuden ADR:n.
