---
id: adr-003
title: monorepo
date: '2026-06-06'
status: accepted
---
## Context
Projekti tarvitsee selkeän hakemistorakenteen automaattisille agenteille, sovellusalueiden omistajuudelle ja versionhallinnalle.

## Decision
Repository toteutetaan monorepona, jonka top-level sovellusalueet ovat `backend/`, `frontend/` ja `infra/`.

## Consequences

- Sovelluskoodi sijoitetaan vastuualueensa mukaiseen top-level-hakemistoon.
- Uudet top-level sovellushakemistot ja jaetut cross-area-paketit vaativat käyttäjän hyväksynnän.
