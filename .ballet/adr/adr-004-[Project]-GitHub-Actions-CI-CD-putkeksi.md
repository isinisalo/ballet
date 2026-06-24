---
id: adr-004
title: GitHub Actions CI/CD-putkeksi
date: '2026-06-06'
status: accepted
---
## Context
Projekti tarvitsee versionhallintaan kytketyn CI/CD-putken pull requestien tarkistuksiin ja hyväksyttyjen muutosten julkaisuihin.

## Decision
GitHub Actions valitaan projektin CI/CD-ratkaisuksi.

## Consequences

- Pull requestien tulee ajaa vähintään aluekohtaiset testit ja quality gate -tarkistukset.
- Jos alueen tarkistuskomentoa ei ole määritetty, puute kirjataan rajoituksena eikä uutta toolchainia keksitä käyttötapaustaskissa.
- AWS-julkaisut toteutetaan ensisijaisesti OIDC-pohjaisella GitHub Actions -luottamuksella ilman pitkäikäisiä AWS-avaimia.
- Pipeline ei saa tuoda uusia runtime-versioita, frameworkkeja tai deployment-malleja ilman hyväksyttyä päätöspintaa.
