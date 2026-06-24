---
id: adr-005
title: Mockoon paikallisiin REST-mockeihin
date: '2026-06-06'
status: accepted
---
## Context
Projekti tarvitsee tavan mockata ulkoisia REST API -palveluita paikallisessa kehityksessä ilman tuotantokutsuja tai oikeita credentialeja.

## Decision
Mockoon valitaan ulkoisten REST API -palveluiden paikalliseen mockaukseen.

## Consequences

- Mockoon-konfiguraatiot versionhallitaan.
- Tuotantokoodi ei saa riippua Mockoonista.
- Mockit eivät korvaa sopimusten tai integraatioiden varsinaista validointia.
