---
id: adr-010
title: StepResult erotetaan runtime-tilasta
status: accepted
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - arkkitehtuuripäätös
  - step-result
  - runtime-tila
version: 2
---

# StepResult erotetaan runtime-tilasta

## Konteksti

Stepin `approved`- ja `rejected`-tulokset ohjaavat Loopin domain-siirtymää. Execution taskin ja Step Runin tilat kuvaavat sen sijaan operatiivista elinkaarta, kuten jonotusta, suorittamista, inputin odottamista, epäonnistumista tai peruutusta. Jos tulos ja tila käsitellään samana asiana, runtime-virhe voi näyttää käyttäjän tai agentin tekemältä hylkäyspäätökseltä ja käynnistää väärän Transitionin.

Nykyinen runtime-malli erottaa jo useimmat näistä arvoista, mutta `AgentOutcome.result` ja `StepRun.result` muodostavat kaksi mahdollista kontrollilähdettä. Raja pitää tehdä eksplisiittiseksi ennen Step execution -mallin muuttamista.

## Päätös

`StepResult` ja runtime state ovat eri käsitteitä ja niillä on eri vastuut.

- Kanoninen `StepResult` on täsmälleen `approved | rejected` ja tallennetaan Step Runille.
- Result syntyy vain validoidusta completed-outcomesta tai Human-Stepin eksplisiittisestä vastauksesta.
- Execution taskin status kuvaa provider-tehtävän elinkaarta arvoilla `queued`, `running`, `succeeded`, `failed` ja `cancelled`.
- Step Runin status kuvaa orkestroinnin elinkaarta arvoilla `queued`, `running`, `waiting_for_human`, `completed`, `needs_input`, `blocked`, `failed` ja `cancelled`.
- Providerin outcome-payload säilyy evidenssinä. Sen sisältämä result validoidaan kerran ja kopioidaan kanoniseen `StepRun.result`-kenttään; Transition engine lukee vain kanonista kenttää.
- `needs_input` ei tuota resultia vaan pausettaa saman Stepin.
- `blocked`, `failed`, `cancelled`, timeout ja provider- tai policy-virhe eivät tuota resultia eivätkä seuraa `rejected`-Transitionia.
- Resultin ja statuksen sallitut yhdistelmät validoidaan. `completed` Agent- tai Human-Step vaatii resultin, ja kaikki muut terminaaliset Step-statusarvot kieltävät sen.
- `completed + rejected` voi seurata `rejected`-Transitionia `blocked`- tai `failed`-terminaaliin. Tämä on eri tapahtuma kuin tekninen `blocked` tai `failed`, jossa result puuttuu eikä Transitionia ajeta.

Päätös täsmentää ADR-004:n Transition-mallia sekä ADR-005:n ja ADR-007:n outcome- ja persistence-rajoja.

## Seuraukset

- Canvasin `Approved` ja `Rejected` tarkoittavat domain-tuloksia, eivät onnistumisen ja teknisen virheen värejä.
- Runtime-virhe ei voi vahingossa käynnistää rework- tai reject-polun liiketoimintaa.
- Run-näkymä voi näyttää rinnakkain tarkan statuksen, mahdollisen resultin ja evidenssin.
- Outcome-resultin ja StepRun-resultin välinen mismatch on integrity-virhe, ei viimeisen kirjoittajan voittava tila.
- Historiallisten Runien immutable outcome-dataa ei kirjoiteta uudelleen; versionoitu read-projektio voi näyttää nykyisen ja uuden muodon yhdenmukaisesti.
- Tilasiirtymä- ja persistence-testien pitää kattaa sallitut sekä kielletyt status/result-yhdistelmät.

## Toteutuksen lähteet

- `shared/domain/runtime.ts`
- `shared/api/runtime-schemas.ts`
- `backend/runtime/LoopRunEngine.ts`
- `backend/runtime/LoopRunStore.ts`
- `backend/execution/ExecutionStore.ts`
- `.ballet/outputs/execution-composition/DATA-MODEL.md`
- `.ballet/outputs/execution-composition/TEST-PLAN.md`
