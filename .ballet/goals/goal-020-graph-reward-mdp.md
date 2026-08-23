---
id: goal-020
title: Graph Engineer toimii yhtenä aitona Reward-MDP-agenttina
status: accepted
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - tavoite
  - reward-mdp
  - graph-engineering
---

# Graph Engineer toimii yhtenä aitona Reward-MDP-agenttina

## Tavoite

Ballet valitsee Graph Runin seuraavan GraphNode-optionin yhdestä Graph-tason discounted Reward-MDP:stä `(S,A,P,R,γ)`. GraphNode on ajallisesti laajennettu action-optio, ei oma policy-scope. Ainakin yhdessä reachable statessa on vähintään kaksi admissible actionia, joten policy tekee aidon valinnan.

## Käyttäjäarvo

- Reward syntyy Validation-evidenssillä varmennetun acceptance-obligaation muutoksesta, ei workflow-noden vaihtumisesta.
- Sama immutable model, snapshot, authorization ja State tuottavat saman compiled policy -taulukon, hashin, Q/V-arvot ja actionin.
- Outcome-ID vaikuttaa sekä rangaistukseen että `Q(s,a)`-arvoon `P(outcome,s′|s,a)`-haaran kautta.
- Hard authorization poistaa actionin `A(s)`:stä. Project State ei voi väärentää erillistä immutable authorization-snapshotia.
- Runtime tekee policy-lookupin eikä ratkaise mallia tai opi transitioneita uudelleen decision epochissa.

## Rajaus

Tavoite kattaa yhden Graph-tason Reward-MDP:n, acceptance-ledgerin, symmetric Dirichlet(1) -default-priorit, deterministic discounted value iterationin, absorption-checkin, ordered GraphNode executionin sekä Validationin bounded `retry | escalate` -semantiikan.

Local Decision Model, scoped orchestrator, agent-router, Repair Node ja Repair call/return, shadow/promotion sekä runtime learning poistuvat aktiivisesta domainista. External write, deploy, release, merge, push ja rollback säilyvät täsmällisen ihmisvaltuutuksen takana.

## Reward- ja todennäköisyyssopimus

`R = completionBonus − actionCost − outcomePenalty + γΦ(s′) − Φ(s)`, missä `Φ(s)=100×(verifiedProgress(s)−1)` ja `γ=0.99`. Defaultit ovat action cost 1, completion bonus 25 sekä penaltyt transient 2, implementation defect 5, invalid plan 12 ja invalid design 25. Arvot persistoiduvat integer-mikroyksikköinä; probabilityt integer-ppm:nä ja summautuvat branchikohtaisesti täsmälleen arvoon 1 000 000.

## Hyväksymisaie

`QS-026` ja `TEST-026` omistavat determinismin, reward hacking -suojan, authorizationin, absorptionin, restart/idempotenssin, strict version cutin, legacy-poiston ja suojatun UI-flow'n acceptance-rajan. Pilotista ei väitetä mitään ilman todellista Root Run -evidenssiä.

## Supersession

Tämä Goal supersedoi `goal-016`, `goal-017` ja `goal-019`. `goal-018`:n capability-first-kortit ja protected Action Node flow säilyvät siltä osin kuin ne eivät kuvaa local policya tai Repairia.

## Ihmispäätös

Projektin omistajan 2026-08-23 antama toteutuspyyntö hyväksyi tämän strict hard cutin, reward-defaultit, default-priorin ja legacy-poiston. Pyyntö ei valtuuta external writea eikä muuta puuttuvaa pilottia suoritetuksi evidenssiksi.
