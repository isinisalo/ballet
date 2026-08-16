---
id: goal-004
title: Work Loop -työnkulut, validointi, korjaus ja ajastus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - tavoite
  - automaatio
  - ajastus
version: 4
---

# Work Loop -työnkulut, validointi, korjaus ja ajastus

## Tavoite

Ballet mahdollistaa työn mallintamisen ymmärrettäviksi Loopeiksi, joissa composite Work Loop Nodet, kanoninen State, Validation-päätökset, korjausreitit, ajastus ja seuraavat vaiheet muodostavat yhden näkyvän ja restart-turvallisen suorituspolun.

Käyttäjän pitää voida nähdä ennen Runia, mistä Loop alkaa, mitä Work tekee, millä kriteereillä Validation päättää `OK` tai `FAIL`, mihin `OK`-Edge johtaa ja mihin Loopeihin Orchestrator saa repair-edgellä reitittää.

## Tarkoitus

Loop tekee monivaiheisen työn rakenteesta eksplisiittisen. Work Loop Node kokoaa yhden Work-vaiheen, sitä seuraavan pakollisen Validation-vaiheen ja rajatun paikallisen retry-kierron. Root Run omistaa revisionoidun Staten. Tavalliset Edget ja Loop Edget näyttävät etenemisen, ja durable Repair Request sekä continuation tekevät ulkoisesta korjauksesta jäljitettävän call/return-operaation.

## Kyvykkyydet

- Loopin descriptionin, State descriptionin, initial JSON Staten ja start Work Loop Noden määrittely.
- Agent-, Human- ja Scheduled Work Nodejen sekä Agent- ja Human Validation Nodejen määrittely.
- Work- ja Validation-tehtävän, ExecutionProfilen, primary instructionin, skillsien, appearance-valintojen ja paikallisen attempt-rajan muokkaaminen composite Node editorissa.
- Validation `OK` -Edgen ohjaaminen seuraavaan Work Loop Nodeen tai eksplisiittiseen `completed | blocked | failed` -terminaaliin.
- Validation `FAIL/LOCAL_RETRY` -paluu saman compositen Work-vaiheeseen kiinteänä invarianttina.
- Validation `FAIL/ORCHESTRATOR_REPAIR` -pyyntö, repair Loop Edge -allowlist, nested repair Loop ja paluu alkuperäiseen Validation Nodeen.
- Root Runin Staten atomiset JSON Patch -revisiot, hashit, lähde-evidenssi ja restart viimeisestä kokonaan commitoidusta revisiosta.
- Kertaluonteinen sekä päivittäin, arkipäivisin, viikoittain tai kuukausittain toistuva ajastus IANA-aikavyöhykkeellä.
- Ajastuksen viimeisimmän tilan ja seuraavan suoritusajan näyttäminen.
- Immutable snapshot, cancellation, finalization, provider-task console ja persisted repair timeline Run-näkymässä.

## Tuotteen rajaukset

- Work tekee työn, Validation päättää ja Loop Orchestrator reitittää; providerin raakateksti ei ohjaa control flow'ta.
- Work Loop Noden sisäiset `Work completed → Validation` ja `Validation FAIL/local → Work` -Edget ovat kiinteitä eivätkä käyttäjän authoroitavia.
- Ajastettu Work Node voi olla vain Loopin aloitus-Work Loop Node, ja Validation Node ei voi olla scheduled.
- Terminaalit ovat Edge target -arvoja, eivät authoroitavia Nodeja.
- Orchestrator voi valita vain immutable snapshotissa olevan ja source-Loopin repair Edgellä allowlistatun target Loopin.
- Return target tulee persistoidusta continuationista ja frame-ketju suljetaan LIFO-järjestyksessä.
- Konfiguraatiograafin syklit ja eksplisiittiset repair self-routet sallitaan; runtime rajaa local attemptit, repair depthin, repair attemptit ja control-flow transitionit.
- Node editor ei ole ExecutionProfilejen settings-sivu eikä palveluntarjoajan asetuseditori.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi määrittää strict-v10 Loopin ja sen Work/Validation-compositet, käynnistää validoidun Root Runin käsin tai ajastuksesta, vastata roolikohtaiseen Human Nodeen, seurata canonical State revisioneita ja nähdä normaalin, paikallisen retry- tai external repair call/return -polun päätyvän deterministisesti oikeaan terminaaliin.
