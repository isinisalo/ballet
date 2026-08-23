---
id: adr-028
title: Routing käyttää outcome-aware scoped finite SSP/SMDP v2 -policya
status: review
createdAt: '2026-08-23T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - policy
  - ssp
  - smdp
version: 1
---

# Routing käyttää outcome-aware scoped finite SSP/SMDP v2 -policya

## Konteksti

ADR-026 toteutti Graph-scopeen finite `ssp_v1`:n, jossa transition oli `P(nextState | state,GraphNode)`. GraphNode-optionin sisäinen JobNode-routing jäi strict candidate enumista päättävälle LLM-orchestratorille, ja verified outcome oli vain `PASS | FAIL`. Candidate-kuvauksissa esiintyvät `invalid_plan`-kaltaiset käsitteet eivät olleet first-class runtime-outcomeja.

Tarvitaan yksi tunnettu formaali routing-malli molempiin scopeihin, mutta ennustemallia ei saa nostaa runtime-totuudeksi. Lisäksi proper-policy-suoja, immutable provenance ja Repairin call/return-raja on säilytettävä.

## Päätösajurit

- `goal-016`, `goal-017`, `REQ-016`, `REQ-017`, `QS-021`–`QS-023`.
- Selitettävä `P(o,s'|s,a)`, Q/V-evidenssi ja model-miss-jälki.
- Canonical state projection, authorization ja fail-closed readiness.
- Ei keksittyjä prioreita, runtime learningia tai strategiafallbackia.
- JobNode Work→Validation→bounded retry ja same-Validation Repair säilyvät.

## Ehdotettu päätös

### Hierarkkinen scoped policy

`ssp_v2` on sama finite solver primitive kahdessa scopeissa:

```text
πG(S) → GraphNode Option
             │
             ▼
πN(s) → JobNode
             │
             ▼
Work → Validation → bounded retry
```

GraphNode on globaalin SMDP:n Option. Sen local policy valitsee JobNoden; JobNode ei hajoa Work- ja Validation-actioneiksi. Repair on bounded call/return-operaatio samaan Validation Nodeen eikä policy-action.

### Canonical ownership

- GraphNode omistaa ID:n, kuvauksen, accepts/provides-sopimukset, intrinsic Graph-outcomet ja JobNodet.
- JobNode omistaa intrinsic local outcomet sekä Work/Validation-lapset.
- Intrinsic outcome on `{ outcomeId, result: PASS | FAIL }`.
- Scoped Capability Model omistaa outcome-katalogin kuvaukset ja action guardit.
- Scoped Decision Model omistaa feature/state-katalogin, availabilityn, `P(outcome,nextState | state,action)`-rivit, scalar costit, terminalit ja solver-asetukset.
- Graph Node Module exporttaa intrinsic outcome -sopimukset mutta ei project-specific probabilityja, costeja tai transitioneita.

### Prediction ei ole truth

Transition-haara on `{ outcomeId, expectedNextStateId, probabilityPpm }`. Validationin `ssp_v2`-tulos sisältää actionin snapshotattuun intrinsic contractiin kuuluvan outcome-ID:n sekä vastaavan `PASS | FAIL` -tuloksen.

Optionin jälkeen actual state projisoidaan aina uudelleen canonical project-, runtime-, authorization-, attempt-, repair- ja evidence-faktoista. Transition-taulukko ennustaa, mutta ei kirjoita statea. Tuntematon tai projisoimaton actual state johtaa `needs_input`-tilaan.

Observation tallentaa lähtötilan, actionin, havaitun outcome-ID:n, PASS/FAIL:n, actual staten, odotetun jakauman ja täsmälleen yhden luokan:

- `match`
- `outcome_miss`
- `state_miss`
- `outside_support`

Observation ei muuta probabilityja eikä costeja. Policy ratkaistaan uudelleen actual statesta.

### Proper-policy-invariantti

`success` on ainoa SSP-goal ja `V(success)=0`. Failure/blocked ovat non-goal-terminaleja, joiden remaining cost on ääretön. Jokaisesta runnable nonterminal-statesta on oltava policy, joka saavuttaa successin probabilityllä 1. Sama ehto tarkistetaan action guardien ja authorizationin jälkeen.

Graph Run on ready vain, jos global model ja jokaisen reachable GraphNode-actionin local model compileutuvat. Draft saa tallentua, mutta ei käynnistää Runia.

### Policy Projection

`Most Likely Rollout` valitaan bounded horizonin kokonaisista terminal/cutoff-trajectorioista suurimman cumulative probabilityn mukaan. Paikallista suurimman successor-haaran greedy-valintaa ei käytetä. Tasatilanne ratkaistaan vakaalla outcome/state/action-ID-järjestyksellä.

### Sopimusleikkaukset ja portit

Portti A käyttää Project Config v16:ta, Graph Node Module v5:tä, Root Snapshot v9:ää, SQLite v12:ta ja uuden outcome/envelope/composition/execution-shapen vastaavia versioita. `agent_v1 | ssp_v2` ovat eksplisiittisiä strategioita molemmissa scopeissa ilman fallbackia. Vanhoja versioita ei lueta eikä migroida.

Portti B:n mandatory-policy cut, Project Config v17, Module v6, Snapshot v10 ja SQLite v13 toteutetaan vasta kalibroidun end-to-end-pilotin ja eksplisiittisen ihmisapprovalin jälkeen. Portti B poistaa molemmat agent-routerit ja niiden provider/candidate/instruction-polut; tätä ei tehdä nykyisessä muutoksessa.

## Seuraukset

- Semantic outcome ja expected-versus-actual ovat first-class runtime-evidenssiä.
- Routingin päätösvalta on `ssp_v2`:ssa deterministisellä solverilla molemmissa scopeissa.
- Project owner joutuu authoroimaan ja hyväksymään finite state abstractionin, probabilityt ja scalar costit.
- Strict readiness voi pysäyttää Runin useammin, mutta ei tee hiljaista fallbackia.
- Local policy lisää snapshot-, persistence- ja UI-evidenssiä, mutta ei muuta Work/Validation/Repair-invariantteja.

## Hylätyt vaihtoehdot

- **Outcome määrää actual staten:** hylätty, koska model prediction ei ole canonical runtime truth.
- **Greedy Expected Path:** hylätty, koska paikallisesti todennäköisin haara ei aina kuulu todennäköisimpään kokonaiseen trajectoryyn.
- **Repair SSP-actionina:** hylätty, koska se rikkoisi bounded same-Validation call/return -rajan.
- **Probabilityjen online update:** hylätty; telemetry on evidenssiä ja learning vaatii uuden päätöksen.
- **Immediate agent strict cut:** hylätty Portti A:ssa, koska calibrated pilot ja eksplisiittinen poistopäätös puuttuvat.

## Evidenssi ja review trigger

Trace on `goal-017` / `REQ-017`, `QS-022`–`QS-023`, `CON-012`, `BB-003`–`BB-005`, `BB-011`, `RT-017`, `TEST-022`, `EVID-022` ja initiative `outcome-aware-hierarchical-policy`.

ADR tarvitsee eksplisiittisen hyväksynnän. Portti B tarvitsee tämän lisäksi suunnitelmassa nimetyn pilotin ja erillisen ihmisapprovalin. Uusi ADR vaaditaan online learningille, multi-objective-costille, POMDP:lle tai Repairin muuttamiselle policy-actioniksi.

