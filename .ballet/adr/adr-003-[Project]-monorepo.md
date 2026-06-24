---
id: adr-003
title: monorepo
created_date: '2026-06-06 07:19'
updated_date: '2026-06-23 07:19'
status: accepted
---
## Context
Projekti tarvitsee selkeän hakemistorakenteen automaattisille agenteille, sovellusalueiden omistajuudelle ja versionhallinnalle.

## Decision
Repository toteutetaan monorepona, jonka top-level sovellusalueet ovat `backend/`, `frontend/` ja `infra/`.

## Consequences

- Sovelluskoodi sijoitetaan vastuualueensa mukaiseen top-level-hakemistoon.
- Uudet top-level sovellushakemistot ja jaetut cross-area-paketit vaativat käyttäjän hyväksynnän.
