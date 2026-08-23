---
id: goal-018
title: Capability-first card authoring
status: accepted
createdAt: '2026-08-23T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - tavoite
  - ui
  - authoring
version: 1
---

# Capability-first card authoring

## Tavoite

Graph Engineering kertoo ensisijaisesti, mitä järjestelmä voi tehdä, ja Graph Node kertoo, mistä JobNode-toiminnoista capability koostuu. Upper-level planet/multi-ring-projektiot korvataan Execution Profiles- ja Skills-näkymien kaltaisilla responsiivisilla korteilla ja URL-omisteisilla osioilla.

Graph Engineering jakautuu `Capability Graph`- ja `Decision Model` -osioihin. Graph Node jakautuu `Jobs`- ja `Local Decision Model & Repair` -osioihin. Nykyinen Job Node industrial flow, Work/Validation-artwork ja bounded retry säilyvät.

## Käyttäjäarvo

- Capabilityt, accepts/provides-sopimukset, intrinsic outcomet ja readiness ovat näkyvissä ilman canvasin tulkintaa.
- CRUD sekä GraphNode- että JobNode-tasolla on suora ja keyboard-käytettävä.
- ID-muutokset päivittävät policy-viitteet atomisesti; viitattu JobNode ei poistu hiljaisesti.
- Run erottaa `Current State`, `Current Decision`, `Policy Projection`, `Most Likely Rollout` ja factual `Execution Graph` -pinnat.

## Rajaus

Muutos poistaa vain Graph- ja GraphNode-tason appearance-, artwork- ja multi-ring-kielen. Se ei muuta ADR-025/027:n Job-flow'ta, canonical runtimea, Repair-semantiikkaa tai provider-rooleja.

## Hyväksymisaie

`QS-024` kattaa desktop/narrow-layoutit, URL-omistajuuden, CRUD-polut, keyboard/focus-käytön, pitkät ID:t, error/readiness-tilat sekä 1/5/40 GraphNode- ja 1/17/64 JobNode -fixturet. Automatisoitu ja browser-evidenssi indeksoidaan `EVID-024`:ään; ihmisvisual verdict pysyy erillisenä hyväksyntänä.

## Ihmispäätös

Käyttäjä valtuutti 2026-08-23 capability-first-authoringin toteutuksen. `ADR-029` dokumentoi tarkat supersession-suhteet ilman ADR-025:n virheellistä korvaamista.

