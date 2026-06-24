---
id: adr-001
title: AWS serverless-alustaksi
created_date: '2026-06-06 07:19'
updated_date: '2026-06-23'
status: accepted
---
## Context
Järjestelmä tarvitsee hallitun pilvialustan HTTP-liikenteelle, sovellusajolle, ajastuksille, konfiguraatiolle, salaisuuksille ja sovellustason infrastruktuurille ilman itse operoitavia palvelimia.

## Decision
AWS valitaan projektin serverless-alustaksi. Julkinen liikenne kulkee CloudFrontin ja API Gatewayn kautta AWS Lambda -funktioille, konfiguraatio säilytetään Parameter Storessa, salaisuudet Secrets Managerissa, ajastukset ja sisäiset tapahtumat EventBridgessä ja backendin serverless-infra AWS SAM -templateissa.

## Consequences

- Toteutus sitoutuu AWS:n palvelumalleihin, IAM-oikeuksiin ja palvelurajoihin.
- Lambda-sovelluslogiikan tulee olla tilatonta ja yhteensopivaa serverless-ajomallin kanssa.
- Reititys-, CORS-, välimuisti- ja virhekäytännöt määritellään eksplisiittisesti API- ja jakelukerroksessa.
- Lambda-funktiot saavat lukea vain tarvitsemansa parametrit ja salaisuudet, eikä salaisuuksia saa lokittaa.
- Ajastetut ja tapahtumapohjaiset tausta-ajot mallinnetaan idempotenteiksi käsittelijöiksi.
- Deploy- ja paikalliskehitysmallin tulee tukea SAM build-, testaus- ja deploy-virtoja.
- Tuotantodeploy, tuotantodata, cloud-oikeudet, uusi AWS-palvelu, laaja IAM-wildcard tai pysyvä konsolimuutos vaatii eksplisiittisen hyväksynnän.
