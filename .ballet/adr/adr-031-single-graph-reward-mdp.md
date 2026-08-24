---
id: adr-031
title: Graph Engineering käyttää yhtä compiled discounted Reward-MDP:tä
status: superseded
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 3
tags:
  - arkkitehtuuripaatos
  - reward-mdp
  - orchestration
---

# Graph Engineering käyttää yhtä compiled discounted Reward-MDP:tä

> **Supersession notice (2026-08-23):** `adr-033` korvaa single-policy-, ledger-state- ja ordered ActionNode -osat. Tämä tiedosto säilyttää alkuperäisen päätöksen audit trailina.

## Konteksti

Scoped `agent_v1 | ssp_v2` -malli sisälsi kaksi eri control-mallia, paikalliset solverit ja erillisen Repair call/return -järjestelmän. Default oli dokumentaation mukaan `agent_v1`, mutta project data käytti keskeneräistä `ssp_v2`:ta. Outcome-aware-nimestä huolimatta reward/cost oli `(state,action)`-tasolla, joten outcome ei vaikuttanut optimointiin. Historiallista kalibrointidataa ei ollut: runtime-kannassa oli muutoksen alussa nolla Runia ja nolla policy-havaintoa.

## Päätösajurit

- `goal-020`, `REQ-020` ja `QS-026`.
- Aito policy-valinta, reward hacking -suoja ja outcome-aware Q-arvo.
- Immutable, toistettava ja auditointikelpoinen snapshot ilman seinäkellosta riippuvaa ratkaisua.
- Yksi control owner ja pienempi domain/persistence/UI-pinta.
- Hard authorization ja ulkoisten kirjoitusten ihmisraja.

## Päätös

### Yksi Graph-tason MDP

Graphin strict `reward_mdp_v3` sisältää `(S,A,P,R,γ)`:n. `A(s)` koostuu GraphNode-optioista, ja GraphNode suorittaa aggregate Action Nodet konfiguraation array-järjestyksessä. GraphNodella ei ole omaa solveria, orchestratoria, Decision Modelia tai Repair Nodea.

Transition on `{ outcomeId, nextStateId, probabilityPpm, provenance }`. Runtime outcome-ID:n on kuuluttava option semantic outcome -enumiin. Sama next state voi saada eri rewardin eri outcome-ID:llä.

### Reward ja acceptance-ledger

Reward on:

```text
completionBonus - actionCost - outcomePenalty + γΦ(s′) - Φ(s)
Φ(s) = 100 × (verifiedProgress(s) - 1)
```

Vain Validation saa evidenssiviitteillä verify- tai invalidate-obligaation. Obligation-ID:t ja integer-painot snapshotataan ennen Runia, eikä aktiivinen Run voi muuttaa niitä. Duplicate verification antaa progress-rewardia nolla; invalidointi voi tuottaa negatiivisen potential-deltan. LLM:n numeerista progress-arviota ei hyväksytä.

### Priori, compiler ja runtime

Authored evidencen puuttuessa jokaisen branchin prior on symmetric Dirichlet(1), muunnettuna deterministisesti exact integer-ppm-jakaumaksi. Provenienssi on `default_prior`. Runtime ei päivitä mallia havaintojen perusteella.

Compiler canonicalisoi kaikki set-mäiset inputit, ratkaisee discounted value iterationin deterministic iteration boundilla ja stable lexical tie-breakillä, tarkistaa valitun policyn almost-sure absorptionin ja tuottaa immutable Q/V/policy-taulukon sekä SHA-256-hashin kerran Root Snapshot v11:een. Nonterminal recurrent class hylätään. Runtime projisoi Staten, ratkaisee hard `A(s)`:n ja tekee taulukko-lookupin.

### Authorization ja suoritus

Authorization on project Statesta erillinen immutable snapshot. Guardin hylkäämä action puuttuu `A(s)`:stä, saa persisted decision-evidenssissä Q-arvon 0 eikä dispatchaudu. Authorizationia ei mallinneta penaltynä.

Action Node suorittaa Work→Validationin. Validation FAIL on `retry | escalate`; retry noudattaa `maxRetries`-rajaa, ja escalate tai loppunut retry palauttaa typed semantic outcomen Graph-MDP:lle. Strict v18 nimeää aggregaatin ja sen sopimuskentät yksiselitteisesti `ProjectActionNode` / `actionNodes` / `actionNodeId`; vanhaa `JobNode`-nimeä tai aliasia ei jää aktiiviseen domainiin. Erillistä Repair-roolia tai Repair-persistenceä ei ole.

### Strict cut

Yksi hard cut nostaa Project Configin v18:aan, Decision Modelin v3:een, Graph Node Modulen v6:een, Root Snapshotin v11:een, Task Envelope/Outcomen v9:ään, compositionin v10:een, ExecutionSpecin v11:een, policy observationin v4:ään ja SQLiten v14:ään. Vanhoja readereita, migraatioita, aliaksia, dual-writeä tai legacy-tauluja ei ole.

## Seuraukset

- Control flow'lla on yksi policy owner; local policy-, Repair- ja promotion-pinnat poistuvat.
- Default-priori tekee mallista heti ohjauskelpoisen, mutta ilmaisee heikon tietopohjan näkyvästi.
- Acceptance-state-avaruus voi kasvaa obligationien määrän mukana; nykyinen bounded compiler hylkää sopimusrajat ylittävän mallin.
- Runtime observation säilyy auditointina, ei online learning -syötteenä.
- Puuttuva tuotantokaltainen pilotti säilyy avoimena riskinä, vaikka hermetic acceptance läpäisisi.

## Hylätyt vaihtoehdot

- **Positiivinen reward jokaisesta workflow-vaiheesta:** hylätty loop/release-splitting reward hackingin vuoksi.
- **Scoped local solverit:** hylätty päällekkäisenä control ownerina ja tarpeettomana kompleksisuutena.
- **Seinäkellotimeout solverin päätöksessä:** hylätty epädeterministisenä.
- **History-derived defaultit tai online posterior mutation:** hylätty, koska havaintoa ei ollut ja snapshotin pitää olla immutable.
- **Unauthorized action penaltynä:** hylätty, koska forbidden action ei kuulu valintajoukkoon.
- **Legacy-migraatio:** hylätty, koska säilytettävää Run- tai calibration-dataa ei ollut ja tuote ei ole tuotannossa.

## Supersession

ADR supersedoi kokonaan `adr-026`, `adr-028` ja `adr-030`; `adr-023`:sta supersedoidaan scoped routing-, orchestrator-, Repair- ja `JobNode`-domain-osat; `adr-029`:stä local Decision Model & Repair -osat. `adr-025` ja `adr-027` säilyvät protected Action Node flow'n visuaalisena sopimuksena, mutta niiden historiallinen `Job Node` -nimi ei ole aktiivinen schema/API/runtime-termi. Historiallisia tiedostoja ei poisteta eikä niiden aikaisempia perusteluja esitetä aktiivisena nykytilana.

## Evidenssi ja review trigger

Trace on `goal-020` / `REQ-020`, `QS-026`, `adr-031` / `CON-013`, `BB-013`, `RT-020`, `TEST-026`, `EVID-026` ja initiative `graph-reward-mdp`.

Uusi ADR vaaditaan online learningille, POMDP:lle, local solverin palautukselle, automaattiselle external writelle tai reward-/authorization-semantikan muuttamiselle.
