---
id: ballet-goals-summary
title: Ballet-projektin yhteenveto
status: accepted
createdAt: '2026-07-18'
updatedAt: '2026-08-29'
version: 20
tags:
  - yhteenveto
  - tavoitteet
---

# Ballet-projektin yhteenveto

> **Balletin hyväksytty suunta on ihmisen hyväksymistä Use Caseista johdettu Environment → State → Action, jossa Validation ohjaa työn ja immutable runtime todentaa toteutuneen vaikutuksen.**

![Balletin projektikartta](./ballet-project-map.png)

## Käyttäjäarvo

Ballet erottaa human-approved project intentionin, deterministic order/controlin ja toteutuneen execution truthin. Accepted targetissa approved Use Caset ja Goals/ADRs/Constraints ohjaavat ordered State/Action -rakennetta, Validation kontrolloi Workia ja ihmisapproval portittaa Critic/Refinement-vaikutukset. Provider ei valitse seuraavaa Statea/Actionia eikä hyväksy omaa proposaliaan.

## Hyväksytty target

`goal-022` / `adr-034` / `REQ-022` hyväksyvät Project Config v20-, Snapshot v13-, Task/outcome v10-, composition v11-, ExecutionSpec v12- ja SQLite v16 -cutin sekä Feedback/Critic/Refinement v1:n. Targetin 13 Use Casea, exact ordering/retry/approval/refinement/UI-semantics ja removal-gatet ovat `environment-state-action-orchestration`-initiativen Target Contractissa. Toteutusevidenssit `EVID-028`–`EVID-032` ovat pending.

## Aktiivinen tuote

Phase 09:ään asti aktiivinen toteutusbaseline on edelleen:

1. Repositoryssä authoroidaan Goalit, ADR:t, arc42, global 5×5 ja GraphNode-local N×N Reward Decision Modelit, nodet, Work/Validation, ExecutionProfilet, instructionit ja skillit.
2. GraphNode ja ActionNode ovat oman scopensa state/action-ID:itä; terminalit eivät lisää matriisirivejä.
3. Validation-evidenssi verify/invalidate-päivittää acceptance-ledgeriä; duplicate verification ei tuota uutta progress-rewardia.
4. Hard authorization poistaa actionin `A(s)`:stä. External write tarvitsee erillisen täsmällisen ihmisvaltuutuksen.
5. Runtime tekee global→local→Action→local→global-lookupit ja soveltaa bounded `retry | escalate` -semantiikkaa.
6. UI näyttää 5×5/N×N Q(s,a)-matriisin, reward/cost/estimate-värit, exact detailin ja erillisen acceptance-gaten. Protected Action Node flow säilyy.

## Strict implementation cut

Project Config v19; Decision Model v4; Graph Node Module v7; Root Snapshot v12; Task Envelope/Outcome v9; composition v10; ExecutionSpec v11; policy decision/observation v5; SQLite v15. Aktiivisia agent-router-, Repair-, shadow/promotion- tai compatibility-polkuja ei ole.

Default project data sisältää viisi GraphNodea, 17 ActionNodea, global 15/25 ja local yhteensä 84 authoroitua solua. Graph Node Library sisältää 14 v7-pakettia, jotka kantavat local policyn mutta eivät peer-matriisia tai acceptance-binding/effectejä.

## Päätöshistoria

`goal-022` ja `adr-034` ovat accepted target. `goal-021` ja `adr-033` omistavat aktiivisen v19 implementation baselinen phase 09:ään asti. Final cut supersedoi Graph/module/policy/matrix/control-osat ADR-034:n täsmällisen listan mukaan; historia säilyy audit trailina.

## Todentamatta

- Tuotantokaltainen viiden GraphNoden Reward-MDP Root Run -pilotti.
- Kaikki targetin `EVID-028`–`EVID-032` implementation-, browser-, release- ja startup-tulokset.
- Pinned tracker/provider live-smoke siltä osin kuin ulkoinen prerequisite puuttuu.
- Ihmisen lopullinen visual review desktop/narrow-pinnasta.

Tekninen acceptance ei muuta näitä automaattisesti suoritetuksi eikä valtuuta releasea, deployta, mergeä tai pushia.

## Kanoninen lukujärjestys

1. [ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [goal-022](goal-022-validation-led-environment-orchestration.md)
3. [adr-034](../adr/adr-034-validation-led-environment-state-action-orchestration.md)
4. [arc42-indeksi](../arc42/README.md) ja [TRACEABILITY](../arc42/TRACEABILITY.md)
5. [Environment orchestration Target Contract](../arc42/initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md)
