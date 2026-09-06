---
id: goal-016
title: Geneerinen SSP/SMDP-policyorkestrointi
status: superseded
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - tavoite
  - policy
  - ssp
  - smdp
version: 3
---

# Geneerinen SSP/SMDP-policyorkestrointi

> Superseded by `goal-020`. Tämä tiedosto säilyy historiallisena audit trailina eikä kuvaa aktiivista strategiavalintaa.

## Tavoite

Ballet voi valita Graph Runin seuraavan käyttäjän määrittelemän `GraphNode`-option eksplisiittisestä, versionhallittavasta ja immutableen Root Run -snapshotiin jäädytetystä finite SSP/SMDP -päätösmallista. Päätös tehdään vain nykyisestä rajatusta `DecisionState`-projektiosta ja kovien kontrollien sallimasta toimintojoukosta.

`GraphNode` säilyy käyttäjän luomana, nimettävänä, muokattavana ja poistettavana capabilitynä. Platform ei tunne repositoryn oletus-GraphNodejen nimiä, järjestystä tai toimitusmerkitystä.

## Käyttäjäarvo

- Operaattori voi erottaa repository-backed Capability Graphin, versionoidun Decision Modelin, nykyisen policyn read-only-projektion ja toteutuneen Execution Graphin toisistaan.
- Jokainen policy-päätös on toistettavissa model/snapshot-hashista, rajatusta Decision Statesta, admissible action -joukosta, `Q(s,a)`-arvoista ja solver-evidenssistä.
- Permission, human authorization, immutable snapshot membership ja candidate membership rajaavat `A(s)`:n; niitä ei muuteta kustannuksiksi tai rangaistuksiksi.
- Project owner määrittää transition-priorit ja scalar-kustannukset eksplisiittisesti. Runtime ei keksi probabilityjä eikä muuta niitä automaattisesti havaintojen perusteella.

## Rajaus

Ensimmäinen toteutus koskee vain Graph-scopea. Graph Noden sisäinen JobNode-orkestrointi, Work→Validation, bounded retry ja same-Validation repair-return säilyvät nykyisinä hierarkkisina invariantteina. Graph-tasolla tuetaan eksplisiittisesti konfiguroitavaa `agent_v1`- tai `ssp_v1`-strategiaa ilman hiljaista fallback-ketjua.

`ssp_v1` käyttää finite state/action -mallia, positiivista scalar stage costia, eksplisiittisiä absorbing success/failure/blocked-terminal-tiloja ja standardia bounded value iteration -ratkaisua. Mallin pitää sisältää vähintään yksi proper policy, joka saavuttaa success-terminalin todennäköisyydellä 1 jokaisesta sallitusta ei-terminaalisesta lähtötilasta; muuten Run ei tee routing-päätöstä.

## Non-goals

- Reinforcement learning, online learning tai automaattinen probability-/cost-muutos.
- POMDP/belief-state, jatkuvat state-avaruudet tai geneerinen probabilistinen ohjelmointikieli.
- Moniulotteinen painotettu kustannuskehys ensimmäisessä toteutuksessa.
- JobNode-scopeen rekursiivisesti ulotettu policy solver.
- Toinen workflow engine, mutable Current Plan tai UI:n policy projection control truthina.

## Hyväksymisaie

Tavoitteen hyväksymisraja on `QS-021`: täysin project-agnostinen fixture käyttää vähintään viittä oletusprojektista riippumatonta GraphNode-ID:tä, ratkaisee saman snapshotin ja Decision Staten toistuvasti identtiseen policyyn, hylkää invalidin/epätäydellisen mallin fail-closedisti ja persistoi jokaisen decision epochin sekä option observationin ilman probability-mutaatiota.

## Ihmispäätökset

Projektin omistaja hyväksyi 2026-08-22 toteutustehtävän yhteydessä:

1. explicit `agent_v1 | ssp_v1` -strategiaraja;
2. proper-policy-vaatimus ja failure/blocked-terminalien ääretön SSP-arvo;
3. ensimmäisen version fixed-point probability/cost -esitykset ja solver-rajat; sekä
4. strict version cutin tarkat contract- ja SQLite-versionumerot.

## Todentaminen

`TEST-021` kattaa schema-, state projection-, admissibility-, solver-, snapshot-, persistence-, restart-, Run projection- ja arbitrary GraphNode -matriisin. `EVID-021` indeksoi toteutuksesta ja porteista saadun konkreettisen evidenssin.
