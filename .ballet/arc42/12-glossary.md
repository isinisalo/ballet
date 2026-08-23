---
id: arc42-section-12
title: Sanasto
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 19
tags:
  - arc42
  - glossary
arc42Section: 12
---

# 12. Sanasto

## Tarkoitus

Tämä osio määrittää aktiivisen Graph Reward-MDP-, authoring-, runtime-, persistence-, module- ja evidenssisanaston. Historialliset Loop/Workflow/agent/SSP/Repair/calibration-termit ratkaistaan niiden superseded Goal/ADR-tiedostoista eikä niitä kopioida aktiiviseksi rinnakkaissanastoksi.

## Aktiivinen strict cut

Project Config v18, Decision Model v3, Graph Node Module v6, Root Snapshot v11, Task Envelope/Outcome v9, composition v10, ExecutionSpec v11, policy observation v4 ja SQLite v14.

## Domain ja authoring

| Termi | Määritelmä |
| --- | --- |
| Graph | Project-global automation boundary, joka omistaa bounded project Staten, yhden Reward Decision Modelin ja 1–40 GraphNodea. |
| GraphNode | Käyttäjän authoroima capability ja Reward-MDP:n ajallisesti laajennettu action-optio. Omistaa intrinsic semantic outcomet ja ordered Action Nodet. |
| Action Node | Strict-v18 aggregate `ProjectActionNode`. Omistaa yhden Workin, yhden Validationin, intrinsic outcomet ja `maxRetries`:n. |
| Work | Action Noden työn tuottava rooli. Ei valitse GraphNodea tai seuraavaa Action Nodea. |
| Validation | Action Noden evidenssiä tarkistava rooli. Palauttaa PASS/FAIL:n, semantic outcome-ID:n, acceptance-muutoksen ja FAILissa `retry | escalate` -dispositionin. |
| Ordered execution | GraphNode suorittaa Action Nodet konfiguraation `actionNodes`-array-järjestyksessä. Local policya ei ole. |
| Capability Graph | GraphNode-korttien authoring-projektio. Ei runtime graph eikä policy. |
| Reward Decision Model | Graph-tason `(S,A,P,R,γ)`-authoring ja factual compile preview. GraphNodella ei ole local Decision Modelia. |
| Protected Action flow | ADR-025/027:n Start→Work→Validation→Pass?/Retry?→Continue/Escalate -authoring-projektio. Vain Work ja Validation ovat interaktiivisia. |

## Reward-MDP

| Termi | Määritelmä |
| --- | --- |
| Reward-MDP | Discounted Markov Decision Process `(S,A,P,R,γ)`, jossa `A` on GraphNode-optiojoukko ja `γ=0.99`. |
| State `s` | Exact Decision Model v3 -state, joka yhdistää bounded feature-arvot sekä verified/invalidated acceptance-obligaatiot. |
| `A(s)` | Hard admissible GraphNode-actionit. Snapshot membership, guardit ja erillinen authorization poistavat forbidden actionit ennen optimointia. |
| `P(outcome,s′ given s,a)` | Outcome-aware transition-haara integer-ppm:nä. Branchit summautuvat täsmälleen arvoon 1 000 000. |
| `default_prior` | Symmetric Dirichlet(1):stä deterministisesti muodostettu exact-ppm-priori, kun authored evidenssiä ei ole. Se ei ole kalibroitu väite. |
| `authored_evidence` | Ihmisen/evidenssin authoroima transition-provenienssi. Runtime observation ei vaihda provenienssia tai arvoa. |
| Reward | `completionBonus − actionCost − outcomePenalty + γΦ(s′) − Φ(s)` integer-mikroyksikköinä. |
| Potential `Φ` | `100 × (verifiedProgress − 1)` reward-yksikköinä. Potential-based shaping palkitsee acceptance-ledgerin deltaa, ei workflow-noden vaihtoa. |
| Q/V | Compilerin read-only action/state-arvot. Ne ovat policy-evidenssiä, eivät UI-inputteja tai toteutunutta progressia. |
| Absorbing policy | Valittu policy saavuttaa terminalin todennäköisyydellä 1 eikä sisällä nonterminal recurrent classia. |
| Compiled policy | Deterministic value iterationin, stable tie-breakin ja absorption-checkin tuottama immutable state→action/Q/V-taulukko Root Snapshotissa. |

## Acceptance ja authorization

| Termi | Määritelmä |
| --- | --- |
| Acceptance obligation | Vakaa ID, kuvaus ja positiivinen integer-paino, joka snapshotataan ennen Runia. |
| Acceptance ledger | Immutable-ID/paino snapshot ja runtime-status `pending | verified | invalidated`. Vain Validation saa muuttaa statusta evidenssiviitteillä. |
| Verified progress | Verified-obligaatiopainon osuus kokonaispainosta. Duplicate verification ei muuta osuutta; invalidointi voi laskea sitä. |
| Authorization snapshot | Project Statesta erillinen immutable lupatotuus ja hash. Project State ei voi antaa actionille lupaa. |
| Hard authorization | Unauthorized action puuttuu `A(s)`:stä, saa decision-evidenssissä Q-arvon 0 ja dispatchaantuu nolla kertaa. Se ei ole reward penalty. |

## Runtime ja evidenssi

| Termi | Määritelmä |
| --- | --- |
| Root Run | Graph- tai GraphNode-targetin immutable-snapshotattu suoritus erillisessä Git-worktreessä. Standalone Action Node Runia ei ole. |
| Root Snapshot v11 | Project/head/config/resource/composition/theme/runtime-tiedot sekä authorization, acceptance-ledger ja compiled policy. |
| Policy decision v3 | Projected state, hard admissible/excluded actionit, Q/V, selected action ja model/policy/snapshot hashit. |
| Policy observation v4 | Toteutunut GraphNode-outcome, actual state, acceptance-ledger, reward, expected distribution ja provenance. Ei online-learning-komento. |
| State | Bounded `GraphEngineeringStateV1`-project/runtime-viitteet. Ei authorizationia, acceptance-ledgeriä, policyä, dokumentteja tai lokeja. |
| `retry` | Validation FAIL ajaa saman Action Noden Workin uudelleen vain `maxRetries`-rajan sisällä. |
| `escalate` | Validation FAIL tai loppunut retry päättää GraphNode-optionin typed semantic outcomella Graph Reward-MDP:lle. Erillistä Repair-roolia ei ole. |
| Factual execution | Canonical SQLite/root snapshot -projektio toteutuneista invokaatioista, outcomesta, rewardista ja tilasta. Provider-proosa ei ole control truth. |

## Module ja platform/project-raja

| Termi | Määritelmä |
| --- | --- |
| Graph Node Module v6 | Yhden GraphNoden, ordered Action Nodejen, intrinsic outcomejen ja resource closuren portable package. Ei local policya, Repairia, Graph-transitioneita tai rewardia. |
| Materialisointi | Inspect→plan→commit-kopio project-local-resursseiksi config-last-periaatteella. Package ei ole live runtime dependency. |
| Platform primitive | Geneerinen Graph/GraphNode/ActionNode/Work/Validation/Reward-MDP/ledger/auth/snapshot/runtime/provider/store-ominaisuus. |
| Project-local data | Default-nodejen nimet, arc42/release/deploy-menettely, instructions, skills, outcomes ja Reward-MDP-rivit repositoryssä. |
| Strict cut | Producerit ja consumerit vaihtuvat yhdessä; vanhaa readeria, migraatiota, aliasia tai dual-writeä ei jää. |

## Historiallinen sanasto

`JobNode`, `jobNodes`, `agent_v1`, `ssp_v1`, `ssp_v2`, scoped orchestrator, local Decision Model, Repair Node, RepairRequest/frame/result sekä shadow/promotion ovat superseded audit trail -termejä. Niitä ei käytetä active configissa, runtime-contractissa, persistence-skeemassa, module v6:ssa tai UI:ssa.

## Kanoniset lähteet

`goal-020`, `adr-031`, shared strict contracts, [STATE-CONTRACT](STATE-CONTRACT.md), [DESIGN](../../DESIGN.md) ja [Graph Reward-MDP initiative](initiatives/graph-reward-mdp/BRIEF.md).

## Review-trigger

Päivitä sanasto, kun public contract, authoring-termi, strict version matrix tai aktiivinen supersession muuttuu. Historiallista termiä ei nosteta aktiiviseksi ilman uutta Goalia ja ADR:ää.
