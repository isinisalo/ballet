---
id: goal-013
title: Erillisiin Job- ja Validation-nodeihin perustuva Workflow Engineering
status: accepted
createdAt: '2026-08-20T00:00:00.000Z'
updatedAt: '2026-08-20T00:00:00.000Z'
tags:
  - tavoite
  - workflow-engineering
  - job-node
  - validation-node
version: 1
---

# Erillisiin Job- ja Validation-nodeihin perustuva Workflow Engineering

## Tavoite

Balletin käyttäjä authoroi valitun `ProjectLoop`in sisäisen työn **Workflow Engineering** -näkymässä. Workflow sisältää erilliset `JobNode`- ja `ValidationNode`-nodet sekä eksplisiittiset `PassEdge`- ja `FailEdge`-yhteydet.

Graph Engineeringin `ProjectLoop`, `LoopNode`, project-global `LoopEdge`, capability-sopimus, Loop Module ja Orchestrator-ohjattu cross-Loop-flow säilyvät.

## Tarkoitus

Työn tekeminen, tuloksen validointi, paikallinen retry ja Workflowsta poistuminen näkyvät samana rakenteena domainissa, runtimessa ja käyttöliittymässä. Composite `WorkLoopNode` ei enää piilota itsenäisesti valittavaa ValidationNodea eikä Validation outcome valitse runtime-reititysmoodia.

## Kyvykkyydet

- Jokainen JobNode omistaa täsmälleen yhden ValidationNoden.
- Jokaisella ValidationNodella on täsmälleen yksi PassEdge ja yksi FailEdge.
- Jobin valmistuminen siirtyy kiinteästi sen ValidationNodeen.
- Validation `PASS` seuraa PassEdgeä seuraavaan JobNodeen tai Workflow `PASS` -endpointiin.
- Validation `FAIL` palaa retry-rajan sisällä kiinteästi paritettuun JobNodeen.
- Retryrajan täytyttyä `FAIL` seuraa FailEdgeä Workflow `FAIL` -endpointiin ja muodostaa target-ID:stä vapaan Repair Requestin Graph Engineeringin Orchestratorille.
- Repair palaa samaan ValidationNodeen uusimmalla Statella ajamatta Jobia uudelleen ja nollaamatta retry-laskuria.
- Tekniset `blocked | failed` -tilat päättävät Runin eivätkä kulje FailEdgeä.
- Workflow-rakenne, reitit ja Run-evidenssi ovat keyboard-käytettäviä sekä desktop- että narrow-viewportissa.

## Hard cut

Aktiivisesta domainista poistuvat `WorkLoopNode`, `WorkNode`, Validation `OK`, `LOCAL_RETRY | ORCHESTRATOR_REPAIR` -valinta, `view=loop` ja `work_loop_node_runs`. Vanhoja lukijoita, route-aliaksia, dual-writeä tai silent defaultteja ei säilytetä.

Koordinoitu versioraja on project config v12, Root Execution Snapshot v5, Loop Module package v2, Task Envelope v5, node outcome v5, execution spec v7 / composition v6 ja SQLite schema v8. Schema v7 -tietokanta epäonnistuu suljetusti ja antaa täsmällisen archive/remediation-ohjeen.

## Rajaukset

- PASS ja FAIL ovat kiinteitä endpointteja, eivät authoroitavia tai suoritettavia nodeja.
- Kiinteä Job → Validation -siirtymä ja retry-siirtymä eivät ole kolmas Edge-laji.
- Project-global Graph, State-omistajuus, Orchestratorin allowlist/capability-valinta, repair-framet, Loop Module -raja ja project/platform-vastuuraja eivät muutu.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat edelleen erillisen ihmisvaltuutuksen.

## Todentaminen

Tavoite on toteutunut, kun strict-v12/v2-schema-, runtime-, Orchestrator-, persistence-, API-, UI-, module- ja legacy-rejection-testit läpäisevät `QS-015` / `TEST-015` -kriteerit, kaikki repository-owned konfiguraatiot ja paketit käyttävät uutta mallia ja lopulliset arc42/test/lint/build/design/diff-gatet onnistuvat.
