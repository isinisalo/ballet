---
id: goal-002
title: Autentikointi
created_date: '2026-06-07 12:35'
updated_date: '2026-06-23'
status: accepted
owner: human
version: 1
supersedes: []
decision_authority: human
tags:
  - intent
  - goal
  - auth
---
# Autentikointi

## GOAL

Tarjoa yritysseurantapalvelulle käyttäjäidentiteetin ja käyttöoikeuden perusta.

Käyttäjän pitää voida rekisteröityä, vahvistaa sähköpostinsa, kirjautua sisään, palauttaa unohtunut salasana ja käyttää vain niitä palvelun osia, joihin hänellä on oikeus. Hallintakäyttäjän pitää voida hallita käyttäjien käyttötilaa.

## INTENT

Autentikointi suojaa yritysseurantapalvelun käyttäjäkohtaiset tiedot ja hallintatoiminnot. Muiden tuotealueiden pitää voida luottaa siihen, että käyttäjän tunnistaminen, käyttötila ja roolit ovat yksiselitteisiä.

Autentikointi ei saa paljastaa asiattomasti käyttäjän olemassaoloa, salaisuuksia, salasanan palautukseen liittyviä salaisuuksia tai roolitietoja.

## CAPABILITIES

- Rekisteröityminen hyväksytyillä käyttäjätiedoilla ja turvallisella oletuskäyttöoikeudella.
- Kirjautuminen vain kirjautumiskelpoiselle käyttäjälle.
- Sähköpostiosoitteen vahvistaminen ennen niiden toimintojen käyttöä, jotka vaativat vahvistetun käyttäjän.
- Salasanan palautuksen pyytäminen ilman, että pyyntö paljastaa onko käyttäjä olemassa.
- Salasanan vaihtaminen hyväksytyn palautusvahvistuksen perusteella.
- Rekisteröityneen, kirjautuneen ja hallintakäyttäjän erottaminen palvelun muille osille.
- Hallintakäyttäjän käyttäjähallinta: käyttäjien listaus, käyttöönotto, käytöstä poisto ja poisto hyväksyttyjen rajojen mukaisesti.

## EVIDENCE

Tavoite täyttyy, kun käyttäjä voi kulkea rekisteröinnistä vahvistettuun kirjautuneeseen käyttöön, palauttaa salasanansa ja saada oikean käyttöoikeuden, ja kun hallintakäyttäjä voi hallita käyttäjän käyttötilaa ilman arkaluonteisen tiedon vuotoa.
