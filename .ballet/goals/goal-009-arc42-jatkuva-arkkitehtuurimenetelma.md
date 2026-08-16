---
id: goal-009
title: arc42-pohjainen jatkuva arkkitehtuurimenetelmä
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - tavoite
  - arc42
  - jatkuva-kehitys
version: 1
---

# arc42-pohjainen jatkuva arkkitehtuurimenetelmä

## Tavoite

Ballet-projekti käyttää arc42 Templatea versionhallittavan arkkitehtuuritiedon rakenteena ja Balletin Looppeja arc42 Methodin jatkuvana toteutuksena.

Ihmisen ja agenttien pitää nähdä samoista kanonisista lähteistä tavoite, nykytila, evidenssi, avoimet kysymykset ja seuraava hyväksytty toiminto.

## Tarkoitus

Arkkitehtuurin, toteutuksen ja arvioinnin pitää muodostaa jatkuva palautesilmukka. Lineaarinen oletuspolku ei saa muuttua vesiputoukseksi: jokainen Validation voi pyytää capability-pohjaisen korjauksen relevantilta arc42-aktiviteetilta, ja runtime määrää paluun alkuperäiseen Validation Nodeen.

## Kyvykkyydet

- `.ballet/arc42/` toimii kanonisena, versionhallittuna arc42 Template -rakenteena.
- Aloitekohtaiset BRIEF-, PLAN-, EVIDENCE- ja REVIEW-artifactit täydentävät projektitason arkkitehtuuria kopioimatta sitä.
- Yhteinen `Arc42MethodStateV1` välittää rajatun nykytilan Looppien välillä ilman dokumenttien täyssisältöä.
- Traceability yhdistää Goalit ja vaatimukset laatuskenaarioihin, päätöksiin, building blockeihin, runtime- ja deployment-skenaarioihin, testeihin ja evidenssiin.
- Evidenssiin perustuva arviointi tunnistaa riskit, technical debtin, architecture driftin ja menetelmän parannustarpeet.
- Ihminen päättää WHAT/WHY-muutoksista, laatutavoitteiden prioriteeteista ja mitoista, merkittävistä ADR:istä sekä ulkoisista kirjoituksista.

## Rajaukset

- Runtime UI ja State-revisiot ovat käynnissä olevan työn toteumatotuus; Markdown on pitkäikäinen projektitotuus.
- Malli ei valitse continuationia, return targetia tai allowlistin ulkopuolista Loopia.
- Release, deploy, rollback, merge ja push eivät käynnisty ilman eksplisiittistä ihmisvaltuutusta.
- Menetelmä ei muuta omaa topologiaansa, oikeuksiaan, verkkoasetuksiaan, instructioneitaan, skillejään tai hyväksyttyjä päätöksiä pelkän malliarvion perusteella.

## Todentaminen

Tavoite toteutuu, kun `npm run validate:arc42` todentaa arc42-rakenteen, strict-v10 Loop-graafin, resurssiviitteet, yhteisen Staten, flow- ja repair-matriisin sekä platform/project-rajan ja ensimmäinen initiative voidaan viedä clarify → structures → concepts → communicate → implementation → evaluate -polun läpi jäljitettävällä evidenssillä.
