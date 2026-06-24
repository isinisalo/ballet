---
id: adr-010
title: JWT-pohjainen API-autentikointi
date: '2026-06-06'
status: accepted
---
## Context
Backend tarvitsee stateless-tavan välittää autentikoidun käyttäjän identiteetti API-kutsuihin ilman palvelinpuolen sessiomuistia.

## Decision
JWT-tokenit valitaan backendin API-autentikoinnin bearer-token-malliksi. API-reuna validoi tokenin ja rakentaa validista tokenista eksplisiittisen `Principal`-olion, joka välitetään use caseille ja auktorisointilogiikalle.

## Consequences

- JWT:t välitetään ensisijaisesti `Authorization: Bearer <token>` -headerissa.
- Tokenin allekirjoitus, expiration, issuer, audience ja vaaditut claimit tarkistetaan ennen use case -kutsua.
- Domain ja application eivät saa importata JWT-kirjastoa, lukea HTTP-headereita tai käsitellä raakaa tokenia.
- JWT-salaisuudet, yksityiset avaimet ja issuer-konfiguraatio säilytetään Secrets Managerissa tai hyväksytyssä turvallisessa konfiguraatiopalvelussa.
- Tokeneita, token-digestejä, salasanoja, password hasheja, API-avaimia, PII:tä tai salaisia avaimia ei saa lokittaa, commitoida, palauttaa API-vastauksessa tai tallentaa fixtureen.
- Refresh-tokenien, revokoinnin ja tokenin elinkaaren yksityiskohdat vaativat erillisen hyväksytyn auth-spesifikaation tai tehtävän.
