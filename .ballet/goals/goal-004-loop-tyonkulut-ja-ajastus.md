---
id: goal-004
title: Loop-työnkulut, hyväksyntäportit ja ajastus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - tavoite
  - automaatio
  - ajastus
version: 1
---

# Loop-työnkulut, hyväksyntäportit ja ajastus

## Tavoite

Ballet mahdollistaa agenttityön mallintamisen ymmärrettäviksi Loopeiksi, joissa agentit, ihmisen päätökset, ajastus ja seuraavat vaiheet muodostavat yhden näkyvän suorituspolun.

Käyttäjän pitää voida nähdä ennen Runia, mistä Loop alkaa, mitä kukin Step tekee ja mihin hyväksytty tai hylätty tulos johtaa.

## Tarkoitus

Loop tekee monivaiheisen agenttityön rakenteesta eksplisiittisen. Ihmisen hyväksyntä säilyy osana samaa tilakonetta, ja ajastus käynnistää vain etukäteen määritellyn työn ilman erillistä automaatiomallia.

## Kyvykkyydet

- Agentti-Steppien, ihmisen hyväksyntäporttien ja ajastettujen Steppien määrittely samaan Loopiin.
- Kiinteiden `approved`- ja `rejected`-Transitionien ohjaaminen paikalliseen nodeen sekä ihmisen Stepistä tarvittaessa eri Loopiin.
- `completed`-, `blocked`- ja `failed`-terminaalien näyttäminen osana Loopin rakennetta ja Run-tilannekuvaa.
- Loopin rakenteen, Transitionien, node-tyylien ja kokojen tarkastelu Loop-visualisoinnissa.
- Ihmisen vastauksen ja hyväksytyn tai hylätyn päätöksen antaminen odottavalle Stepille.
- Kertaluonteinen sekä päivittäin, arkipäivisin, viikoittain tai kuukausittain toistuva ajastus IANA-aikavyöhykkeellä.
- Ajastuksen viimeisimmän tilan ja seuraavan suoritusajan näyttäminen.
- Runin aiemman syötteen ja ihmisen Stepin vastauksen välittäminen seuraavaan Loopiin handoffina.

## Tuotteen rajaukset

- Stepillä on vain kiinteät `approved`- ja `rejected`-outputit.
- Jokaisessa Loopissa on täsmälleen yksi kutakin kiinteää terminaalityyppiä.
- Ajastettu Step voi olla vain Loopin aloitus-Step, ja yhdessä Loopissa voi olla enintään yksi ajastettu Step.
- Terminaalilla ei ole agenttia, ajastusta, outputteja eikä seuraavaa Transitionia.
- Ballet-repositoryn nykyinen ohjelmistotoimitusketju alkaa `blueprint-design`-Loopista ja etenee ihmisen hyväksyntäporttien kautta seuraaviin Loopeihin; ajastus ei ohita ketjun käynnistyskäytäntöä.
- Kehitysketjun jatkoloopit vastaanottavat validoidun virstanpylväs- ja issue-kontekstin.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi määrittää validoidun Loopin, käynnistää käynnistyskäytännön salliman juuren käsin tai ajastuksesta, seurata agentti-Steppiä, vastata ihmisen hyväksyntäporttiin ja nähdä Runin päätyvän oikeaan terminaaliin tai jatkavan validoidulla handoffilla määritettyyn toiseen Loopiin.
