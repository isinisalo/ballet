---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 30
tags:
  - arc42
  - status
  - handoff
---

# Balletin arkkitehtuuristatus ja handoff

## Tarkoitus

Tämä tiedosto ylläpitää project-tason pitkäikäisen arkkitehtuuritilanteen ja yhden seuraavan handoffin kopioimatta runtime-lokeja, ticket-sisältöä tai initiative-dokumentteja.

## Tila

- `goal-001`–`goal-019` ovat accepted. Project owner hyväksyi `goal-017`–`goal-019`- ja `adr-027`–`adr-030`-ketjun commitissa `26698dda09c9e9fda5284d4bfa578d6084581dc5`.
- `goal-016`, `adr-026` ja `QS-021` hyväksyvät Graph-scopeen explicit `agent_v1 | ssp_v1` -strategian, proper-policy-semanticsin, fixed-point mallin ja v15/v8/v11 strict cutin.
- `adr-023` omistaa säilyvän Graph/GraphNode/JobNode-domainin ja bounded Repair Noden. `adr-025`–`adr-027` omistavat Job Node industrial flow'n. Accepted `adr-028`–`adr-030` omistavat hierarchical policy-, capability-first- ja calibration/promotion-muutokset.
- Nykyinen implementation cut on Project Config v17, Graph Node Module v5, Root Snapshot v10, policy observation v3, Task Envelope/Outcome v8, composition v9, ExecutionSpec v10 ja SQLite v13. Compatibility-lukijoita, reittialiaksia, dual-writeä tai runtime-migraatiota ei ole.
- Oletusprojekti sisältää viisi GraphNodea ja 17 aggregate JobNodea, joilla jokaisella on erillinen Work- ja Validation-lapsi. Viiden Graph Noden nimet ja arc42-/release-menettely ovat project-local-dataa.
- Oletusprojekti käyttää edelleen `agent_v1`:tä molemmissa scopeissa, explicit Luna/medium/network-off-orchestratoreita ja Sol/medium/network-off Repair Nodeja. `ssp_v2` on eksplisiittinen global/local-vaihtoehto eikä kutsu LLM:ää routing-päätökseen. Platform ei hardkoodaa malleja eikä GraphNode-nimiä eikä tee fallbackia.
- Julkiset Run-rajat ovat Graph Run ja GraphNode Run. Standalone JobNode Run ja schedule on poistettu. GraphNode Run käyttää Graph-tasoa vain repair-eskalaatioon.
- Canonical authoring-reitit ovat `/automation/graph?section=capabilities|decision-model`, `/automation/graph/nodes/:graphNodeId?section=jobs|local-decision-model` ja `/automation/graph/nodes/:graphNodeId/jobs/:jobNodeId`; Run-reitit ovat `/run/graphs/:graphId` ja `/run/graph-nodes/:graphNodeId`.
- Graph/Graph Node käyttävät responsive capability/decision-model-kortteja. Job Node säilyttää suojatun 24 px gridin ja deterministic industrial flow'n, jossa exact Work/Validation ID -kortit, Pass?/Retry?-junctionit, Retry count -ghost ja Continue/Escalate-ympyrät ovat näkyviä, mutta vain Work/Validation ovat valittavia.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat edelleen täsmällisen ihmisvaltuutuksen.

## Toteutettu fakta, evidenssi ja avoin riski

| Luokka | Nykytila |
| --- | --- |
| Hyväksytty päätös | `goal-015`–`goal-019` ja `adr-023`–`adr-030` omistavat domain-, Job-flow-, finite policy-, authoring- ja governed calibration -rajat. Portti B tarvitsee edelleen erillisen hyväksynnän. |
| Toteutettu fakta | Strict v17 domain/config, Snapshot v10, policy observation v3, SQLite v13, provider-neutral measured/unknown option-costs, hierarchy-safe inclusive attribution, explicit agent/SSP v2 scoped union, Graph/GraphNode Run services, 14 v5-pakettia, capability-first cards ja protected Job flow löytyvät työpuusta. |
| Paikallinen evidenssi | Phase 2:n focused 4/11 ja full 50/191 testit, production/package-buildit, arc42 12/80, lint 0 error / 15 baseline warning, DESIGN 0/0, platform-boundary, diff-check, `make latest` ja installed schema-13 health portissa 53321 ovat passed. Portti A:n aiempi capability-first desktop/narrow/40/64 browser-evidenssi säilyy; narrow Job-flow’n post-fix screenshot ja ihmisvisual review puuttuvat. |
| Avoin riski | Probability/cost/outcome-kalibrointi, `ssp_v2` end-to-end-pilotti, restart/resume-pilottievidenssi, final human review ja Portti B approval puuttuvat. Ne eivät valtuuta agenttipoistoa, releasea tai external writea. Lintin non-blocking warning baseline nousi 8:sta 15:een. |
| Policy Portti A | `outcome-aware-hierarchical-policy` lisää semantic outcomes, scoped `P(o,s'|s,a)`:n, global/local proper policyn, projector-owned actual Staten, neljä model-miss-luokkaa ja immutable provenance -ketjun ilman prior mutationia. |
| UI Portti A | `capability-first-authoring` lisää Capability Graph / Decision Model ja Jobs / Local Decision Model & Repair -osiot sekä scoped Run current decision/projection/execution -pinnat. |
| Governed calibration | `governed-policy-calibration-and-promotion` määrittää accepted provider-neutral option-cost-, immutable dataset/candidate/report-, evaluation/shadow- ja human activation/rollback -rajan. Phase 2 observation on toteutettu; candidatea tai aktivointia ei ole. |

## Kanoniset lähteet

Osioindeksi on [README](README.md), trace-suhteet [TRACEABILITYssa](TRACEABILITY.md), State-raja [STATE-CONTRACTissa](STATE-CONTRACT.md), Job-flow-baseline [job-node-industrial-flow-canvas](initiatives/job-node-industrial-flow-canvas/BRIEF.md)-initiativessa, Portti A:n review-jälki [outcome-aware-hierarchical-policy](initiatives/outcome-aware-hierarchical-policy/BRIEF.md)- ja [capability-first-authoring](initiatives/capability-first-authoring/BRIEF.md)-initiativeissa sekä Phase 1 -governance [governed-policy-calibration-and-promotion](initiatives/governed-policy-calibration-and-promotion/BRIEF.md)-initiativessa.

## Relevantit päätökset

`goal-015`–`goal-019`, `adr-011`, `adr-015`, `adr-016`, `adr-023`, `adr-025`–`adr-030`.

## Evidenssi

- `.ballet/project.json` on strict v17 ja määrittää explicit `agent_v1`-strategian molemmissa scopeissa, viisi GraphNodea, 17 JobNodea, intrinsic outcome -draftit, scoped candidate-säännöt sekä Luna/Sol-mappingit.
- `.ballet/graph-node-library/**` sisältää 14 strict-v5-pakettia.
- `TEST-019` / `EVID-019` omistaa domain/runtime/module/conformance-evidenssin.
- `TEST-020` / `EVID-020` omistaa canonical route-, scope-, a11y-, layout-, browser- ja visual-evidenssin.
- `npm run validate:arc42` on deterministinen repository-conformance-gate.
- `TEST-022`–`TEST-024` / `EVID-022`–`EVID-024` omistavat Portti A:n review-ketjut; implementation/startup/capability-first browser evidence on paikallisesti passed, kalibroitu pilotti, post-fix Job-flow screenshot ja human review pending.
- `TEST-025` / `EVID-025` omistaa accepted calibration/promotion -ketjun; governance ja Phase 2 option-cost observation -evidenssi ovat paikallisesti passed, calibration-, candidate-, shadow-, pilot- ja activation-evidenssi pending.

## Avoimet kysymykset

- Portti A:n capability-first desktop/narrow-selainevidenssi tarvitsee nimetyn ihmisreview'n, vaikka ADR-029 on hyväksytty.
- Mitkä täsmälliset expert-priorit, cost-scalarization-säännöt sekä sample/coverage/readiness-rajat hyväksytään Phase 3:n deterministiseen kalibrointiin?
- Pinned tracker/provider live-smoke raportoidaan erikseen eikä hermetic testi korvaa sitä.
- Ensimmäisen pilotin featuret ja pilot-specific arvot päätetään vasta Phase 3–5 evidenssin jälkeen.

## Nykyinen handoff

- Initiativet: `outcome-aware-hierarchical-policy`, `capability-first-authoring` ja keskeneräinen `governed-policy-calibration-and-promotion`.
- Status: `needs_input`; Phase 2 on toteutettu, mutta Phase 3:n project-local priors/scalarization/readiness-inputit puuttuvat.
- Muuttunut stable chain: `goal-019`, `REQ-019`, `QS-025`, `adr-030`, `CON-002`/`CON-012`, `BB-002`–`BB-005`/`BB-011`/`BB-012`, `RT-019`, `TEST-025`, `EVID-025`.
- Seuraava yksi toimi: project owner toimittaa ja hyväksyy Phase 3:n exact priors-, scalarization-, sample-, coverage- ja readiness-arvot.
- Stop condition: deploy/release/merge/push vaatii erillisen täsmällisen valtuutuksen.

## Seuraava katselmointiperuste

Päivitä final gatejen, conformance Validationin, projektin omistajan visual review'n tai uuden hyväksytyn Goal/ADR-muutoksen jälkeen.
