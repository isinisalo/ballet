---
id: goal-017
title: Outcome-aware hierarchical SSP/SMDP routing
status: accepted
createdAt: '2026-08-23T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - tavoite
  - policy
  - ssp
  - smdp
version: 1
---

# Outcome-aware hierarchical SSP/SMDP routing

## Tavoite

Ballet laajentaa `goal-016`:n finite SSP/SMDP-mallin molempiin varsinaisiin routing-scopeihin. Graph-policy valitsee GraphNode-optionin ja GraphNode-local policy JobNode-actionin. JobNode säilyttää deterministisen Work→Validation→bounded retry -mekanismin.

Jokainen `ssp_v2`-transition mallintaa `P(outcome,nextState | state,action)`. Validation palauttaa deklaroidun semantic outcome-ID:n sekä canonical `PASS | FAIL` -tuloksen. Mallin ennustama next state ei koskaan korvaa canonical project/runtime/authorization-faktoista tehtyä actual state -projektiota.

## Käyttäjäarvo

- Routing on molemmissa scopeissa tarkastettava, toistettava ja proper-policy-invariantin suojaama.
- Execution Graph näyttää outcome- ja state-missit odotuksen sekä actual projectionin rinnalla.
- LLM:t tuottavat Work-, Validation-, estimation- ja Repair-työtä, mutta `ssp_v2`:ssa eivät valitse seuraavaa GraphNodea tai JobNodea.
- Draft voidaan tallentaa ilman keksittyjä probabilityja tai costeja; Run estyy, kun reachable scoped model ei compileudu.

## Portit

Portti A toteuttaa explicit `agent_v1 | ssp_v2` -strategian molemmissa scopeissa ilman fallbackia sekä strict v16/v5/v9/v12 -sopimusleikkauksen. Default-projekti pysyy `agent_v1`:ssä, kunnes project owner hyväksyy outcome-katalogit, probabilityt ja costit.

Portti B poistaa molemmat agent-routerit vasta hyväksytyn kokonaisen `ssp_v2`-pilot Runin, viiden proper local policyn, restart/provenance- ja mittakaavaevidenssin sekä erillisen ihmisapprovalin jälkeen. Portti B ei kuulu nykyiseen toteutukseen.

## Non-goals

- Probabilityjen tai costien automaattinen kalibrointi runtime-havainnoista.
- Repair actionina tai routing-policyna.
- Work- ja Validation-roolien muuttaminen erillisiksi MDP-actioneiksi.
- `agent_v1`:n poistaminen ennen hyväksyntäporttia.
- Vanhojen config-, module-, snapshot- tai SQLite-versioiden migraatio.

## Hyväksymisaie

`QS-022` ja `QS-023` omistavat policy-turvallisuuden sekä model-miss-jäljitettävyyden. Portti A:n automatisoitu implementation-evidenssi indeksoidaan `EVID-022`:een. Pilotin latency-, cost-, retry-, model-miss- ja completion-evidenssi pysyy pending-tilassa, kunnes kalibroitu malli hyväksytään ja oikea Run suoritetaan.

## Ihmispäätös

Käyttäjä valtuutti 2026-08-23 Portti A:n toteutuksen. Project ownerilta tarvitaan vielä erikseen:

1. probabilityjen, costien ja outcome-katalogien hyväksyntä ennen pilottia;
2. pilotin hyväksyntä; ja
3. eksplisiittinen Portti B:n agenttirouting-poisto.

