---
id: arc42-section-12
title: Sanasto
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 21
tags:
  - arc42
  - glossary
arc42Section: 12
---

# 12. Sanasto

## Tarkoitus

Tämä osio erottaa aktiivisen strict-v19-sanaston hyväksytystä Environment-target-sanastosta. Target-termi ei muutu aktiiviseksi toteutusfaktaksi ennen phase-09 strict cutoveria.

## Aktiivinen strict cut

Project Config v19, Decision Model v4, Graph Node Module v7, Root Snapshot v12, Task Envelope/Outcome v9, composition v10, ExecutionSpec v11, policy decision/observation v5 ja SQLite v15.

## Hyväksytty target strict cut

Project Config v20, Root Snapshot v13, Task Envelope/role outcome v10, prompt composition v11, ExecutionSpec v12, SQLite v16 sekä Feedback-, Critic- ja Refinement-contract v1. Decision Model-, Graph Node Module- ja policy decision/observation -versioita ei ole targetissa.

| Target-termi | Määritelmä |
| --- | --- |
| Environment | Approved Use Casen project-local execution definition, joka omistaa unique ascending `order` -arvoilla järjestetyt Statet. Ei freeform graph eikä policy. |
| State (target) | Environmentin ordered execution unit. Omistaa unique ascending `priority` -arvoilla järjestetyt Actionit; seuraava State ei dispatchaannu ennen nykyisen kaikkien Actionien johdettua `done=true`-tilaa. Eri käsite kuin aktiivisen v19:n bounded `GraphEngineeringStateV1`. |
| Action (target) | Staten priority-ordered execution unit, jolla on Validation, subordinate Work, `maxRetries` ja canonical runtime status. Ei standalone Run -target. |
| Action runtime status | Canonical enum-siirtymä, josta `done` ja `blocked` johdetaan; boolean-arvoja ei tallenneta project configiin itsenäiseksi totuudeksi. |
| Validation precheck | Actionin controller-kutsu ennen Workia; sallittu tulos on vain `done | delegate | blocked`. |
| Validation postwork | Workin jälkeen ajettava controller-kutsu; sallittu tulos on vain `done | retry | blocked`. |
| `maxRetries` (target) | Ensimmäisen Work-yrityksen jälkeen sallittujen lisäyritysten määrä; Work-yritysten enimmäismäärä on `1 + maxRetries`. |
| Feedback Box | Canonical Feedback v1 -kokoelma hyväksytyistä ihmisen palautteista ja runtime-blockereista. Critic proposal ei ole Feedback ennen human approvalia. |
| Critic proposal | Scheduled Criticin read-only, revisionoitu ehdotus, joka voi tulla Feedbackiksi vain erillisellä ihmisen approval-komennolla. |
| Refinement proposal | Read-only exact diff, joka on sidottu base-committiin, diff-hashiin ja sallittujen polkujen preimage-hasheihin. |
| Continuation Run | Hyväksytyn refinement-commitin uusi immutable Environment Run, jonka lineage viittaa parent Runiin, Feedbackiin, proposaliin, approvaliin ja committiin. Parentia ei mutatoida in-place. |
| Product Snapshot | Read-only commit/artifact/evidence-projektio; ei project truth eikä dispatch authority. |
| vNext transition | Phaseissa 02–08 käytetty määräaikainen eristys namespace/hakemisto-, `/api/vnext`-, `/vnext`- ja erillisen runtime-store-rajan takana. Ei compatibility layer; kaikki prefixit poistuvat phase 09:ssä. |

## Domain ja authoring

| Termi | Määritelmä |
| --- | --- |
| Graph | Project-global automation boundary, joka omistaa Staten, acceptance-ledgerin, global Reward Decision Modelin ja 1–40 GraphNodea. |
| GraphNode | Käyttäjän authoroima capability, global policyn state/action sekä oman local Reward Decision Modelinsa omistaja. Omistaa Graph-outcomet/effectit ja ActionNodet. |
| Action Node | Strict-v19 aggregate `ProjectActionNode`; local policyn state/action. Omistaa Workin, Validationin, intrinsic outcomet ja `maxRetries`:n. |
| Work | Action Noden työn tuottava rooli. Ei valitse GraphNodea tai seuraavaa Action Nodea. |
| Validation | Action Noden evidenssiä tarkistava rooli. Palauttaa PASS/FAIL:n, semantic outcome-ID:n, acceptance-muutoksen ja FAILissa `retry | escalate` -dispositionin. |
| Hierarchical execution | Global policy valitsee GraphNoden, local policy ActionNoden; typed outcome valitsee branchin ja local terminal palauttaa GraphNode-outcomen global policylle. |
| Capability Graph | GraphNode-korttien authoring-projektio. Ei runtime graph eikä policy. |
| Reward Decision Model | Scopekohtainen `(S,A,P,R,γ)`-authoring ja compile preview: Graph 5×5, GraphNode N×N. |
| Protected Action flow | ADR-025/027:n Start→Work→Validation→Pass?/Retry?→Continue/Escalate -authoring-projektio. Vain Work ja Validation ovat interaktiivisia. |

## Reward-MDP

| Termi | Määritelmä |
| --- | --- |
| Reward-MDP | Discounted Markov Decision Process `(S,A,P,R,γ)`; `S=A` johdetaan scopea omistavista node-ID:istä ja `γ=0.99`. |
| State `s` | Exact GraphNode-ID globaalissa tai ActionNode-ID paikallisessa Decision Model v4 -scopessa. |
| `A(s)` | Scopen modeled ja guard/authorization-sallittu node-ID-joukko nykytilassa. |
| `P(outcome,target given s,a)` | Outcome-aware state- tai terminal-branch integer-ppm:nä; solun summa on täsmälleen 1 000 000. Havainto, ei satunnaisotos, valitsee branchin. |
| `default_prior` | Symmetric Dirichlet(1):stä deterministisesti muodostettu exact-ppm-priori, kun authored evidenssiä ei ole. Se ei ole kalibroitu väite. |
| `authored_evidence` | Ihmisen/evidenssin authoroima transition-provenienssi. Runtime observation ei vaihda provenienssia tai arvoa. |
| Reward | `terminalSuccessBonus − actionCost − outcomePenalty`; Graphissa lisäksi `γΦ(target) − Φ(s)`, integer-mikroyksikköinä. |
| Potential `Φ` | Vain GraphNodeihin eksplisiittisesti sidottujen acceptance-obligaatioiden ordered painopotentiaali. Local rewardissa aina nolla. |
| Q/V | Compilerin read-only action/state-arvot. Ne ovat policy-evidenssiä, eivät UI-inputteja tai toteutunutta progressia. |
| Absorbing policy | Valittu policy saavuttaa terminalin todennäköisyydellä 1 eikä sisällä nonterminal recurrent classia. |
| Compiled policy | Deterministic value iterationin, stable tie-breakin ja absorption-checkin tuottama immutable state→action/Q/V-taulukko Root Snapshotissa. |

## Acceptance ja authorization

| Termi | Määritelmä |
| --- | --- |
| Acceptance obligation | Vakaa ID, kuvaus ja positiivinen integer-paino, joka snapshotataan ennen Runia. |
| Acceptance ledger | Immutable-ID/paino snapshot ja runtime-status `pending | verified | invalidated`. Vain Validation saa muuttaa statusta evidenssiviitteillä. |
| Acceptance effect gate | Local terminalin emitted GraphNode-outcomen effectien ja terminal Validationin exact ledger-deltan/evidenssin vertailu ennen global branchia. |
| Verified progress | Verified-obligaatiopainon osuus kokonaispainosta. Duplicate verification ei muuta osuutta; invalidointi voi laskea sitä. |
| Authorization snapshot | Project Statesta erillinen immutable lupatotuus ja hash. Project State ei voi antaa actionille lupaa. |
| Hard authorization | Unauthorized action puuttuu `A(s)`:stä, saa decision-evidenssissä Q-arvon 0 ja dispatchaantuu nolla kertaa. Se ei ole reward penalty. |

## Runtime ja evidenssi

| Termi | Määritelmä |
| --- | --- |
| Root Run | Graph- tai GraphNode-targetin immutable-snapshotattu suoritus erillisessä Git-worktreessä. Standalone Action Node Runia ei ole. |
| Root Snapshot v12 | Project/head/config/resource/composition/theme/runtime-tiedot sekä authorization, acceptance-ledger ja compiled global/local policyt. |
| Policy decision v5 | Scope, GraphNode-konteksti, state, admissible/excluded actionit, Q/V, selected action ja hashit. |
| Policy observation v5 | Scope-tagged ActionNode- tai GraphNode-outcome, actual state/terminal, acceptance-ledger, reward ja expected branchit. |
| State | Bounded `GraphEngineeringStateV1`-project/runtime-viitteet. Ei authorizationia, acceptance-ledgeriä, policyä, dokumentteja tai lokeja. |
| `retry` | Validation FAIL ajaa saman Action Noden Workin uudelleen vain `maxRetries`-rajan sisällä. |
| `escalate` | Validation FAIL/outcome kulkee local branchille ja saavuttaa global policyn vain authoroidun local terminalin emitted GraphNode-outcomena. |
| Factual execution | Canonical SQLite/root snapshot -projektio toteutuneista invokaatioista, outcomesta, rewardista ja tilasta. Provider-proosa ei ole control truth. |

## Module ja platform/project-raja

| Termi | Määritelmä |
| --- | --- |
| Graph Node Module v7 | Yhden GraphNoden, ActionNodejen, intrinsic outcomejen, local policyn/rewardin/initial staten ja resource closuren portable package. Ei peer-matriisia tai acceptance-binding/effectejä. |
| Materialisointi | Inspect→plan→commit-kopio project-local-resursseiksi config-last-periaatteella. Package ei ole live runtime dependency. |
| Platform primitive | Geneerinen Graph/GraphNode/ActionNode/Work/Validation/Reward-MDP/ledger/auth/snapshot/runtime/provider/store-ominaisuus. |
| Project-local data | Default-nodejen nimet, arc42/release/deploy-menettely, instructions, skills, outcomes ja Reward-MDP-rivit repositoryssä. |
| Strict cut | Producerit ja consumerit vaihtuvat yhdessä; vanhaa readeria, migraatiota, aliasia tai dual-writeä ei jää. Target-cut poistaa myös kaikki vNext-prefixit ja vanhan Graph/Reward-MDP-pinnan. |

## Historiallinen sanasto

`JobNode`, `jobNodes`, `agent_v1`, `ssp_v1`, `ssp_v2`, scoped LLM-orchestrator, Repair Node, RepairRequest/frame/result, single 62-state policy sekä shadow/promotion ovat superseded audit trail -termejä. ADR-033:n node-ID local Decision Model on aktiivinen eri sopimus.

## Kanoniset lähteet

Aktiivinen sanasto: `goal-021`, `adr-033`, shared strict contracts, [STATE-CONTRACT](STATE-CONTRACT.md) ja [Hierarchical Reward-MDP initiative](initiatives/hierarchical-reward-mdp/BRIEF.md). Target-sanasto: `goal-022`, `adr-034`, [TARGET-CONTRACT](initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md) ja [DESIGN target appendix](../../DESIGN.md).

## Review-trigger

Päivitä sanasto, kun public contract, authoring-termi, strict version matrix tai aktiivinen supersession muuttuu. Historiallista termiä ei nosteta aktiiviseksi ilman uutta Goalia ja ADR:ää.
