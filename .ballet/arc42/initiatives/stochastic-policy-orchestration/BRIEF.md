---
id: stochastic-policy-orchestration-brief
title: Stochastic Policy Orchestration BRIEF
status: accepted
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 2
tags:
  - arc42
  - initiative
  - policy
  - ssp
---

# Stochastic Policy Orchestration BRIEF

## Initiative ja status

Initiative ID on `stochastic-policy-orchestration`, omistaja Ballet-projektin omistaja ja hyväksytty intentio on `goal-016` / `REQ-016`. Projektin omistaja hyväksyi 2026-08-22 SPO-OQ-001–004:n sekä implementation authorityn. Säilyvät accepted-rajat ovat `goal-002`, `goal-006`, `goal-007` ja `goal-015`.

## Faktat ja päätösaihio

- **Fakta SPO-F-001:** strict-v15 Graph valitsee explicit `agent_v1 | ssp_v1` -strategian; GraphNode-orchestratorit säilyvät LLM Node Runeina ja SQLite v11 persistoi agent routing- tai SSP decision/observation -faktat erillisinä evidensseinä.
- **Fakta SPO-F-002:** `ProjectGraph` omistaa 1–40 user-defined `ProjectGraphNodea`; parseri ja runtime viittaavat niihin stable ID:illä, vaikka repositoryn default-data käyttää viittä project-local nimeä.
- **Fakta SPO-F-003:** Root Snapshot v8 jäädyttää koko Graphin, strategian, canonical model/capability-hashit, Staten initial-arvon, execution profiles/resources ja rights-boundaryn; Graph State revisionit ja repair-framet ovat canonical machine-local-faktoja.
- **Päätös SPO-D-001:** Graph-scope käyttää explicit `agent_v1 | ssp_v1` -strategy unionia; fallbackia strategioiden välillä ei ole.
- **Päätös SPO-D-002:** `ssp_v1` käyttää finite Decision State catalogia, GraphNode Optioneita, hard admissibilityä, explicit fixed-point transition-prioreja, positive scalar costia ja proper-policy SSP value iterationia.
- **Päätös SPO-D-003:** Capability Graph, Decision Model, Policy Projection ja Execution Graph ovat eri omistajuusrajoja; projection ei ole mutable workflow truth.

## Sidosryhmät

| Sidosryhmä | Odotus |
| --- | --- |
| Project owner / domain expert | Authoroi state abstractionin, probability-priorit, costit ja terminal objective -määrittelyn eikä saa hiljaisia oletuksia. |
| Operaattori | Näkee current Decision Staten, admissible/excluded actionit, selected actionin, Q/V-arvot, projectionin ja factual trajectoryn proveniensseineen. |
| Runtime maintainer | Saa yhden orchestration runtimen, pure solver-portin, atomisen decision/dispatchin ja restart-safe observation-evidenssin. |
| Security reviewer | Voi osoittaa, että permission/authorization poistaa actionin eikä muuta rewardia/costia. |
| Riippumaton Validation | Voi toistaa policy/hash/Q-arvot samasta snapshotista ja löytää improper/invalid modelin ennen dispatchia. |

## Scope

- Graph-scope finite episodic MDP/SSP ja SMDP Option -semantiikka.
- Bounded Decision State projection canonical runtime-/State-/authorization-faktoista.
- Explicit agent/SSP strategy config, immutable model snapshot/hash ja pure deterministic solver.
- Decision epoch / option observation -persistence sekä Configure/Run-omistajuusrajat.
- Arbitrary GraphNode fixture: `discover`, `prototype`, `security-check`, `package`, `publish` sekä toinen täysin uudelleennimetty variantti.
- Accepted Goal/ADR/CON/BB/RT/QS/RISK/TEST/EVID-trace ja implementation slice.

## Non-goals

- Täysi visual Policy Projection -editori/rollout ensimmäisen runtime-core-slicen osana.
- RL, online learning, probability mutation, multi-objective solver, POMDP tai continuous state.
- GraphNode-scope/JobNode-scope policy solver.
- Platformiin hardkoodattu default-GraphNode, workflow stage tai prior/cost.
- Release, deploy, merge, push tai muu ulkoinen kirjoitus.

## Rajoitteet

- Strict-v15/v8/v11 on active baseline; v14/v7/v10:lle ei ole compatibility-readeria tai migraatiota.
- Hard controls muodostavat `A(s)`:n; unauthorized actionin Q-arvoa ei lasketa.
- Decision State on finite enum-vector, ei arbitrary State JSON.
- Probabilityt ovat authoroituja fixed-point-arvoja; summaa ei normalisoida eikä puuttuvaa arvoa keksitä.
- Terminal on explicit state; candidatejen puuttuminen ei finalisoi Runia.
- UI-muutos ei saa vaihtaa suojattua Graph/GraphNode/Job-canvas-kieltä ilman erillistä supersedoivaa UI-ADR:ää.

## Laatutavoite

`QS-021` on hyväksytty prioriteetilla 1. Kriteeri vaatii saman snapshotin/Decision Staten policy- ja Q-arvot 100 % byte-/numeric-identtisiksi toleranssisopimuksen puitteissa, foreign/unauthorized action -vaikutuksen nollaksi, invalid/improper/non-convergent-mallin dispatchit nollaksi, probability-autoupdatet nollaksi ja arbitrary-node-fixtureiden saman käyttäytymisen ilman platform-name-osumia.

## Oletukset, hypoteesit ja löydökset

- **Oletus SPO-A-001:** project owner pystyy ensimmäisessä pilotissa antamaan reviewoitavat priors/costit; Ballet ei voi todentaa niiden domain-kalibraatiota pelkällä schema-testillä.
- **Hypoteesi SPO-H-001:** inspectable SSP policy vähentää routing-driftiä ja tekee cost/transition-oletukset näkyvämmiksi kuin LLM-only Graph routing.
- **Löydös SPO-FIND-001:** current State sisältää bounded canonical facts, mutta se ei itsessään täytä Markov-vaatimusta; erillinen feature catalog ja model uncertainty -dokumentointi ovat välttämättömiä.

## Ratkaistut hyväksyntäkysymykset

- **SPO-OQ-001:** hyväksytty `agent_v1 | ssp_v1` coexistence ilman fallbackia.
- **SPO-OQ-002:** hyväksytty proper-policy + infinite failure/blocked -semantiikka.
- **SPO-OQ-003:** hyväksytty 1 024 state / 40 action / 10 000 iteration / 2 s solver -raja ja fixed-point ppm/microcost -esitys.
- **SPO-OQ-004:** hyväksytty project config v15, Root Snapshot v8 ja SQLite v11; Graph Node Module v4 ja provider-task-contractit säilyvät.

Ensimmäinen runtime-core-slice on toteutettu. Pilotin domain-priorien kalibrointi ja täysi Configure/Run policy-projektio ovat seuraavat review-rajat.
