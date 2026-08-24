---
id: arc42-section-06
title: Ajonaikainen näkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 19
tags:
  - arc42
  - runtime
arc42Section: 6
---

# 6. Ajonaikainen näkymä

## Tarkoitus ja tila

Tämä osio kuvaa strict-v19:n aktiiviset arkkitehtonisesti merkittävät runtime-skenaariot. RT-020/021:n single-policy/array-order-osat ovat historiallisia; RT-022:n recovery, RT-023:n GraphNode Root Run ja RT-024:n module-polku säilyvät ADR-033:n tarkentamina. RT-025 omistaa hierarkkisen global/local-suorituksen.

## RT-025: hierarchical Reward-MDP Root Run

```mermaid
sequenceDiagram
  actor Operator as Operaattori
  participant Planner as GraphExecutionPlanner
  participant Compiler as RewardMdpCompiler
  participant Store as SQLite v15
  participant Runtime as RuntimeFlowCoordinator
  participant Provider as Work / Validation provider

  Operator->>Planner: Start Graph Run
  Planner->>Planner: Validate strict v19 resources
  Planner->>Planner: Snapshot project State, authorization and acceptance obligations
  Planner->>Compiler: Compile global + reachable local scopes
  Compiler-->>Planner: absorbing policies + Q/V + hashes
  Planner->>Store: Commit Root Snapshot v12 and ledger
  loop combined global/local decisions ≤ 256
    Runtime->>Store: Persist global decision v5
    Runtime->>Runtime: Dispatch selected GraphNode
    loop local policy until terminal
      Runtime->>Store: Persist local decision v5
      Runtime->>Provider: selected Action Work v9
      Provider-->>Runtime: strict Work outcome
      Runtime->>Provider: paired Validation v9
      Provider-->>Runtime: typed outcome + PASS/FAIL + evidence + retry/escalate
      alt bounded retry remains
        Runtime->>Provider: same Action Work, next attempt
      else observed local branch
        Runtime->>Store: Local observation v5 and state/terminal
      end
    end
    alt acceptance effects match exact ledger delta
      Runtime->>Store: Atomic ledger + global observation v5 + branch
    else mismatch
      Runtime->>Store: needs_input before ledger/global state effect
    end
  end
  Runtime-->>Operator: typed terminal success/failure/block
```

Planner ei käytä wall-clock-timeoutia policy-päätökseen. Compiler johtaa ID:t nodeista, canonicalisoi sparse exact-PPM-branchit ja integer-mikroyksiköt sekä ratkaisee jokaisen scopen deterministic iteration boundilla ja stable lexical tie-breakillä. Graph Run vaatii global + reachable local absorptionin; GraphNode Run vain target-localin.

Runtime ei ratkaise mallia uudelleen, arvo successor-tilaa eikä mutatoi probabilityjä/rewardia. Havaittu outcome-ID valitsee branchin deterministisesti. `Continue` palauttaa outcome-ID:n local policylle; `Escalate` saavuttaa global policyn vain local-terminalin emitted GraphNode-outcomena. Unauthorized action poistuu `A(s)`:stä ja dispatchaantuu nolla kertaa.

### Action Node ja acceptance-portti

1. Local compiled policy valitsee ActionNoden nykyisestä ActionNode-ID-statesta.
2. Schema-validi Work `completed` johtaa aina saman ActionNoden Validationiin.
3. Validation FAIL + `retry` ajaa saman Workin uudelleen vain `maxRetries`-rajan sisällä.
4. PASS, `escalate` tai loppunut retry palauttaa typed ActionNode-outcomen local branchille.
5. State target käynnistää seuraavan local lookupin; terminal target emittoi authoroidun GraphNode-outcomen.
6. Terminal Validationin acceptance-deltan ja evidenssin on vastattava emitted GraphNode-outcome-effectejä exactisti.
7. Duplicate verify, sitomaton GraphNode tai ActionNode-splittaus ei tuota Graph-progress-rewardia.

Action Nodejen välillä ei ole authoroitavaa Edgeä tai provider-routeria. Local policy on ainoa ActionNodejen välisen control flow'n omistaja.

## RT-022: restart, cancellation ja idempotenssi

- Queue ja invocation lifecycle ovat persistenttejä. Restart palauttaa queued-työn; kesken ollut provider-suoritus muuttuu interrupted-tilaan eikä replaya terminal outcomea.
- State-, acceptance-, outcome- ja control-flow-vaikutus näkyy vasta kokonaisen SQLite-transaktion jälkeen.
- Cancellation/finalization on durable barrier myöhäiselle provider-payloadille; post-cancel state-effect on 0.
- Policy decision viittaa model-, policy- ja snapshot-hasheihin. Observation viittaa täsmälliseen GraphNode invocationiin eikä kirjoita mallia.
- Tracker outbox käyttää stable external-refiä ja estää control flow'n, kunnes partial external effect on sovitettu.

## RT-023: GraphNode Root Run

GraphNode Root Run käyttää samaa strict snapshot-, worktree-, local policy-, Work/Validation-, retry/escalate- ja persistence-polkuja, mutta ei compileeraa tai dispatchaa global policya. Se päättyy local terminaliin eikä jatka peer-GraphNodeen.

## RT-024: Graph Node Module

Module inspect rajoittaa koon, validoi strict v7 JSON:n mukaan lukien local policyn ja laskee canonical hashin. Plan näyttää namespacen, profile/resource mappingin, konfliktit ja provenance-muutokset. Commit re-plannaa samasta inputista, materialisoi resource closuren ja kirjoittaa Project Config v19:n viimeisenä. Uusi node jättää global-matriisin incomplete-tilaan. Runtime ei lue packagea.

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
| RT-020 | historical | Single Graph Reward-MDP; säilyvät periaatteet ovat RT-025:ssä. |
| RT-021 | historical | Array-ordered Action execution; Work→Validation/retry säilyy RT-025:ssä. |
| RT-022 | active | Restart, cancellation and idempotency. |
| RT-023 | active | GraphNode Root Run. |
| RT-024 | active | Graph Node Module v7 materialization. |
| RT-025 | active | Hierarchical global/local Reward-MDP Root Run. |

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
| Retryrajan ylitys | Retryä ei dispatchata; typed outcome palaa local policylle. | Local branch valitsee state-targetin tai terminalin. |
| Acceptance-effect mismatch | Root pysähtyy `needs_input`:iin; ledger/global state effect = 0. | Korjaa Validation-evidenssi tai authoroitu GraphNode-outcome ja vastaa uudelleen. |
| Provider preflight/protocol failure | Tehtävä failed/interrupted ilman provider-fallbackia. | Korjaa profiili/provider ja käynnistä uusi yritys. |
| Persistence failure | Koko transaction rollback. | Restart/retry viimeisestä commitista. |
| Module stale/conflict | Commit estyy; configia ei kirjoiteta. | Inspect/plan uudelleen nykytilasta. |
| External write ilman authorizationia | Action puuttuu hard admissible setistä tai Node pysähtyy `needs_input`:iin; kirjoituksia 0. | Ihminen antaa täsmällisen valtuutuksen uuteen snapshotiin. |

## Kanoniset lähteet ja evidenssi

`adr-033` omistaa control semanticsin. `backend/policy/PolicyScope.ts`, `backend/policy/RewardMdpCompiler.ts`, `backend/runs/GraphExecutionPlanner.ts`, `backend/runtime/RuntimeFlowCoordinator.ts`, `backend/runtime/RuntimePolicyStore.ts` ja `backend/storage/RuntimeSchema.ts` omistavat suoritettavan käytöksen. `TEST-027` / `EVID-027` kattavat deterministic scope-policy-, ledger-gate-, authorization-, retry/escalate-, restart- ja persistence-skenaariot. Tuotantokaltainen pilotti pysyy avoimena.

## Seuraava katselmointiperuste

Katselmoi osio, kun uusi failure-, concurrency-, recovery-, authorization- tai external-effect-skenaario muuttaa yllä kuvattuja invariantteja.
