---
id: adr-009
title: backend-runtime ja kirjastopino
created_date: '2026-06-06 07:19'
updated_date: '2026-06-23 07:19'
status: accepted
---
## Context
Backend tarvitsee Python-runtimeen sopivan kirjastopinon HTTP-rajapintoihin, Lambda-ajoon, AWS-integraatioihin, validointiin, persistenssiin, riippuvuuksien koostamiseen, autentikointiin, ulkoisiin HTTP-kutsuihin, testaukseen ja laadunvarmistukseen.

## Decision
Backend toteutetaan Python 3.14:llä. Kirjastopinoksi valitaan FastAPI, Mangum, boto3, moto 5, Pydantic, PynamoDB, Ruff, mypy, Punq, responses, iisi-app-core, PyJWT[crypto] ja requests.

## Consequences

- FastAPI julkaisee HTTP-endpointit ja OpenAPI-skeeman, Mangum rajataan Lambda-ASGI-entrypointtiin ja Pydantic ulkokerrosten validointiin.
- boto3-, PynamoDB-, requests-, PyJWT- ja muut teknologiakirjastot rajataan adaptereihin, composition rooteihin tai API/auth-ulkokerrokseen.
- Punqia ja iisi-app-corea saa käyttää riippuvuuksien koostamiseen, autoloadiin, ports-and-adapters-bootstrapiin ja FastAPI + Mangum -bootstrapiin ilman, että domain riippuu niistä.
- Ruff vastaa linttauksesta, formatoinnista ja import-järjestyksestä; mypy vastaa staattisesta tyyppitarkistuksesta.
- moto 5 mockaa boto3-pohjaisia AWS-adapteritestejä ja responses mockaa requests-pohjaisia HTTP-client-testejä.
- Riippuvuuksien versionnostot tai uuden backend-kirjaston lisääminen edellyttävät yhteensopivuuden tarkistusta ja hyväksyttyä toteutustehtävää tai uutta ADR:ää.
