---
id: goal-004
title: Loop-työnkulut, hyväksyntäportit ja ajastus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - tavoite
  - automaatio
  - ajastus
version: 2
---

# Loop-työnkulut, hyväksyntäportit ja ajastus

## Tavoite

Ballet mahdollistaa työn mallintamisen ymmärrettäviksi Loopeiksi, joissa suoritettavat Stepit, ihmisen päätökset, ajastus ja seuraavat vaiheet muodostavat yhden näkyvän suorituspolun.

Käyttäjän pitää voida nähdä ennen Runia, mistä Loop alkaa, mitä kukin Step tekee, millä valinnoilla se suoritetaan ja mihin `approved`- tai `rejected`-tulos johtaa ilman palveluntarjoajan runtime-rakenteen tuntemista.

## Tarkoitus

Loop tekee monivaiheisen työn rakenteesta eksplisiittisen. Step kokoaa yhden tehtävän valinnat, Transitionit näyttävät tuloksen jälkeisen etenemisen ja ihmisen hyväksyntä säilyy osana samaa tilakonetta. Ajastus käynnistää vain etukäteen määritellyn työn ilman erillistä automaatiomallia.

## Kyvykkyydet

- Aloitus-Stepin sekä `agent`-, `human`- ja `scheduled`-tyyppisten Steppien määrittely samaan Loopiin.
- Suoritettavan Stepin tehtäväkuvauksen, ExecutionProfilen, primary instructionin, skillsien sekä `approved`- ja `rejected`-kohteiden muokkaaminen samassa Node editorissa.
- Kiinteiden `approved`- ja `rejected`-Transitionien ohjaaminen paikalliseen nodeen sekä ihmisen Stepistä tarvittaessa eri Loopiin.
- Completed outcomen tai Human-vastauksen tuottaman `approved`- tai `rejected`-tuloksen erottaminen teknisistä `blocked`-, `failed`-, `cancelled`- ja `needs_input`-tiloista, jotka eivät aktivoi Transitionia.
- Terminaalien ja teknisten Run-tilojen näyttäminen osana Loopin rakennetta ja Runin tilannekuvaa.
- Loopin rakenteen, Transitionien, node-tyylien ja kokojen tarkastelu Loop-visualisoinnissa siten, että Canvasin Transitionit ja Run-tila pysyvät erillisinä käsitteinä.
- Ihmisen vastauksen ja hyväksytyn tai hylätyn päätöksen antaminen odottavalle Stepille.
- Kertaluonteinen sekä päivittäin, arkipäivisin, viikoittain tai kuukausittain toistuva ajastus IANA-aikavyöhykkeellä.
- Ajastuksen viimeisimmän tilan ja seuraavan suoritusajan näyttäminen.
- Runin aiemman syötteen ja ihmisen Stepin vastauksen välittäminen seuraavaan Loopiin handoffina.

## Tuotteen rajaukset

- Stepillä on vain kiinteät `approved`- ja `rejected`-outputit.
- Jokaisessa Loopissa on täsmälleen yksi kutakin kiinteää terminaalityyppiä.
- Ajastettu Step voi olla vain Loopin aloitus-Step, ja yhdessä Loopissa voi olla enintään yksi ajastettu Step.
- Terminaalilla ei ole Step-suoritusmääritystä, ajastusta, outputteja eikä seuraavaa Transitionia.
- Ensimmäiseen versioon ei lisätä Role-, Preset-, Policy- tai Recipe-entityä.
- Node editor ei ole ExecutionProfilejen settings-sivu eikä palveluntarjoajan asetuseditori.
- Appearance- ja Advanced-osiot pysyvät toissijaisina ja oletuksena suljettuina.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi tunnistaa Node editorista Stepin tehtävän, ExecutionProfilen, primary instructionin, skillsit ja molemmat jatkokohteet, käynnistää validoidun Loopin käsin tai ajastuksesta, vastata Human-porttiin ja nähdä Runin päätyvän oikeaan terminaaliin tai jatkavan validoidulla handoffilla määritettyyn toiseen Loopiin.
