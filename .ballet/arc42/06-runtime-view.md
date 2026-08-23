---
id: arc42-section-06
title: Ajonaikainen näkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 18
tags:
  - arc42
  - runtime
arc42Section: 6
---

# 6. Ajonaikainen näkymä

## Tarkoitus ja tila

Tämä osio kuvaa strict-v18:n aktiiviset arkkitehtonisesti merkittävät runtime-skenaariot. Aiemmat RT-001–RT-019-tunnisteet säilyvät historiallisessa trace- ja initiative-evidenssissä, mutta niiden Loop/Workflow-, scoped orchestrator-, SSP-, Repair-, shadow- tai promotion-polut eivät ole nykyistä runtimea. RT-020 omistaa yhden Graph Reward-MDP:n suorituksen.

## RT-020: Graph Reward-MDP Root Run

```mermaid
sequenceDiagram
  actor Operator as Operaattori
  participant Planner as GraphExecutionPlanner
  participant Compiler as RewardMdpCompiler
  participant Store as SQLite v14
  participant Runtime as RuntimeFlowCoordinator
  participant Provider as Work / Validation provider

  Operator->>Planner: Start Graph Run
  Planner->>Planner: Validate strict v18 resources
  Planner->>Planner: Snapshot project State, authorization and acceptance obligations
  Planner->>Compiler: Compile canonical Reward-MDP once
  Compiler-->>Planner: absorbing policy + Q/V + hash
  Planner->>Store: Commit Root Snapshot v11 and ledger
  loop decision epoch until terminal
    Runtime->>Runtime: Project state and ledger; form hard A(s)
    Runtime->>Store: Persist compiled-policy decision
    Runtime->>Runtime: Dispatch selected GraphNode option
    loop ordered Action Nodes
      Runtime->>Provider: Work Task Envelope v9
      Provider-->>Runtime: strict Work outcome
      Runtime->>Provider: Validation Task Envelope v9
      Provider-->>Runtime: outcome ID + PASS/FAIL + evidence + retry/escalate
      alt bounded retry
        Runtime->>Provider: same Action Node Work, next attempt
      else continue or escalate
        Runtime->>Store: Atomic State/ledger/outcome facts
      end
    end
    Runtime->>Store: Observation v4 + realized reward
  end
  Runtime-->>Operator: DONE or typed terminal failure/block
```

Planner ei käytä wall-clock-timeoutia policy-päätökseen. Compiler canonicalisoi set-mäiset inputit, exact PPM -branchit ja integer-mikroyksiköt, ratkaisee deterministic value iterationin iteration boundilla ja stable lexical tie-breakillä sekä tarkistaa valitun policyn almost-sure absorptionin. Invalidi tai absorboitumaton malli luo nolla Root Runia.

Runtime ei ratkaise mallia uudelleen eikä mutatoi probabilityjä, rewardia tai prioreja havainnoista. Project State ei voi antaa valtuutusta eikä numeerista LLM-progressia hyväksytä. Unauthorized action poistuu `A(s)`:stä, saa decision-evidenssissä Q-arvon 0 ja dispatchaantuu nolla kertaa.

## RT-021: ordered Action Node execution

1. GraphNode invocation snapshottaa oman Action Node -arraynsa.
2. Runtime dispatchaa ensimmäisen Action Noden Workin.
3. Schema-validi Work `completed` johtaa aina saman Action Noden Validationiin.
4. Validation PASS jatkaa seuraavaan array-alkioon tai päättää option typed PASS-outcomella.
5. Validation FAIL + `retry` ajaa saman Workin uudelleen vain, kun `maxRetries` sallii uuden yrityksen.
6. FAIL + `escalate` tai loppunut retry päättää option typed FAIL-outcomella Graph-MDP:lle.
7. Vain Validation voi evidenssillä verify- tai invalidate-obligaation. Duplicate verify ei muuta progressia.

Action Nodejen välillä ei ole child-to-child policyä, routeria tai authoroitavaa Edgeä. Array-järjestys on execution contract.

## RT-022: restart, cancellation ja idempotenssi

- Queue ja invocation lifecycle ovat persistenttejä. Restart palauttaa queued-työn; kesken ollut provider-suoritus muuttuu interrupted-tilaan eikä replaya terminal outcomea.
- State-, acceptance-, outcome- ja control-flow-vaikutus näkyy vasta kokonaisen SQLite-transaktion jälkeen.
- Cancellation/finalization on durable barrier myöhäiselle provider-payloadille; post-cancel state-effect on 0.
- Policy decision viittaa model-, policy- ja snapshot-hasheihin. Observation viittaa täsmälliseen GraphNode invocationiin eikä kirjoita mallia.
- Tracker outbox käyttää stable external-refiä ja estää control flow'n, kunnes partial external effect on sovitettu.

## RT-023: GraphNode Root Run

GraphNode Root Run käyttää samaa strict snapshot-, worktree-, Action Node-, Work/Validation-, retry/escalate- ja persistence-polkuja, mutta ei tee Graph-policy-dispatchia. Se suorittaa vain valitun option eikä jatka peer-GraphNodeen.

## RT-024: Graph Node Module

Module inspect rajoittaa koon, validoi strict v6 JSON:n ja laskee canonical hashin. Plan näyttää namespacen, profile/resource mappingin, konfliktit ja provenance-muutokset. Commit re-plannaa samasta inputista, materialisoi resource closuren ja kirjoittaa Project Config v18:n viimeisenä. Runtime ei lue packagea. Export/remove säilyttävät shared resource- ja active Run -rajat.

## Skenaarioindeksi

| ID | Tila | Omistaja |
| --- | --- | --- |
| RT-001 | historical | Pre-v18 Root Run baseline; audit trail vanhoissa initiativeissa. |
| RT-002 | historical | Pre-v18 Workflow execution. |
| RT-003 | historical | Pre-v18 Repair call/return. |
| RT-004 | historical | Pre-v18 scheduled learning. |
| RT-005 | historical | External write -ihmisraja säilyy CON-001/QS-007:ssä. |
| RT-006 | historical | Module inspect/install; aktiivinen seuraaja RT-024. |
| RT-007 | historical | Module export/remove; aktiivinen seuraaja RT-024. |
| RT-008 | historical | Composition; aktiivinen sopimus on Task Envelope v9/composition v10. |
| RT-009 | historical | Recovery; aktiivinen seuraaja RT-022. |
| RT-010 | historical | Run projection; aktiivinen acceptance on QS-013/QS-024. |
| RT-011 | historical | Graph/Loop orchestrator. |
| RT-012 | historical | Exact RunBook. |
| RT-013 | historical | Tracker reconciliation; invariantti säilyy RT-022:ssa. |
| RT-014 | historical | Scoped agent routing. |
| RT-015 | historical | Scoped Repair. |
| RT-016 | historical | Graph-only SSP. |
| RT-017 | historical | Scoped outcome-aware SSP. |
| RT-018 | historical | Scoped policy draft/readiness. |
| RT-019 | historical | Offline calibration/shadow/promotion. |
| RT-020 | active | Graph Reward-MDP Root Run. |
| RT-021 | active | Ordered Action Node execution. |
| RT-022 | active | Restart, cancellation and idempotency. |
| RT-023 | active | GraphNode Root Run. |
| RT-024 | active | Graph Node Module v6 materialization. |

## Samanaikaisuusmalli

- Yhden Root Runin Statea tai acceptance-ledgeriä muuttavat roolit etenevät sekventiaalisesti.
- Provider-kohtaiset FIFO-kaistat voivat edetä rinnakkain eri Runeille.
- State revision, SQLite-transaction ja finalization barrier estävät lost update- ja late payload -vaikutukset.
- Authoring/module-mutaatiot serialisoidaan; stale install plan revalidoidaan ennen committia.

## Virhetilat

| Virhe | Fail-closed-vaste | Jatkaminen |
| --- | --- | --- |
| Config/resource/model invalidi | Root Runia tai provider-taskia ei luoda; exact issue raportoidaan. | Korjaa project truth ja käynnistä uusi Run. |
| Empty `A(s)` nonterminalissa | Policy decision failaa, dispatch = 0. | Korjaa authorization tai model guardit. |
| Nonterminal recurrent class / iteration-bound failure | Compile hylätään, Run = 0. | Korjaa finite model. |
| Out-of-enum outcome tai acceptance ilman evidenssiä | Transaction rollback; State/ledger/control effect = 0. | Korjaa Validation-output tai project outcome -katalogi. |
| Work/Validation technical failure | Root/option failaa tai blokkaantuu ilman semanttisen outcomen keksimistä. | Korjaa tekninen syy ja käynnistä valtuutettu uusi ajo. |
| Retryrajan ylitys | Retryä ei dispatchata; typed outcome eskaloituu Graph-MDP:lle. | Policy valitsee seuraavan actionin tai terminalin. |
| Provider preflight/protocol failure | Tehtävä failed/interrupted ilman provider-fallbackia. | Korjaa profiili/provider ja käynnistä uusi yritys. |
| Persistence failure | Koko transaction rollback. | Restart/retry viimeisestä commitista. |
| Module stale/conflict | Commit estyy; configia ei kirjoiteta. | Inspect/plan uudelleen nykytilasta. |
| External write ilman authorizationia | Action puuttuu hard admissible setistä tai Node pysähtyy `needs_input`:iin; kirjoituksia 0. | Ihminen antaa täsmällisen valtuutuksen uuteen snapshotiin. |

## Kanoniset lähteet ja evidenssi

`adr-031` omistaa control semanticsin. `backend/policy/RewardMdpCompiler.ts`, `backend/runs/GraphExecutionPlanner.ts`, `backend/runtime/RuntimeFlowCoordinator.ts`, `backend/runtime/RuntimePolicyStore.ts` ja `backend/storage/RuntimeSchema.ts` omistavat suoritettavan käytöksen. `TEST-026` / `EVID-026` / `GRM-evid-004` kattavat deterministic policy-, ledger-, authorization-, ordered execution-, retry/escalate-, restart- ja persistence-skenaariot. Tuotantokaltainen pilotti pysyy avoimena.

## Seuraava katselmointiperuste

Katselmoi osio, kun uusi failure-, concurrency-, recovery-, authorization- tai external-effect-skenaario muuttaa yllä kuvattuja invariantteja.
