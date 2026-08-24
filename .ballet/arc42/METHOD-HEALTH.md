---
id: arc42-method-health
title: Balletin arc42-menetelmän terveys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 9
tags:
  - arc42
  - method-health
  - runbook
---

# Balletin arc42-menetelmän terveys

## Tarkoitus

Tämä tiedosto seuraa evidenssiä siitä, miten kehitysmenetelmä toimii, ja sallii parannusehdotukset vain mitatun tarpeen perusteella. Se ei ole yleinen changelog eikä runtime-logien kopio.

## Tila

Mittauskontrakti on accepted. Operatiiviset arvot ovat `not measured`, kunnes ensimmäinen viiden GraphNoden Reward-MDP Root Run tuottaa runtime-evidenssin. MHC-004/005 ovat historiallisia; MHC-006 kirjaa aktiivisen hierarchical node-ID Reward-MDP -hypoteesin. Tekniset testit eivät muodosta end-to-end-method-baselinea.

## Terveysmittarit

| Metric ID | Mittari | Baseline | Lähde | Review-trigger |
| --- | --- | --- | --- | --- |
| MH-FAIL | Validation FAIL -määrä ja luokitellut syyt | not measured | Root Run Validation outcomes | sama syy kahdessa initiativessa |
| MH-RETRY | Local retryt Nodea ja syytä kohti | not measured | Node Run attempts | sama Node ylittää yhden retryn kahdessa Runissa |
| MH-ESCALATE | Validation retry/escalate, local terminal ja typed Graph-outcomet | not measured | Node attempts ja policy observations v5 | sama outcome eskaloituu kahdessa Runissa tai retryraja ylittyy |
| MH-OQ | Toistuvat open questionit | not measured | BRIEF/REVIEW ja STATUS | sama kysymys säilyy kahden review’n yli |
| MH-STALE | Vanhentuneet tai ristiriitaiset dokumenttifindingit | migration baseline: summary sisälsi legacy-faktoja; 2026-08-17 active Goal/support -lähteissä havaittiin strict-v10:n vastainen sanasto | evaluation findingit ja legacy-haku | mikä tahansa accepted source contradiction |
| MH-DRIFT | Architecture drift -findingit | not measured | conformance review | mikä tahansa high-impact unaccepted drift |
| MH-EVID | Testi- ja quality scenario -evidenssivajeet | QS-027 implementation/package/browser gates passed; human visual verdict, QS-018 live smoke ja tuotantokaltainen pilotti pending | TRACEABILITY ja REVIEW | release candidate sisältää pending priority-1-QS:n |
| MH-MANUAL | Manual interventionit ja syyt | not measured | `needs_input` ja Human Node outcomes | sama vältettävä syy kahdessa Runissa |
| MH-TRANSITION | Named transitionien määrä, outcome-jakauma ja transition limit -osumat | not measured | `GraphOrchestrationStateV1` ja Root Run controls | odottamaton outcome, puuttuva route tai yli 128 transitionin Run |
| MH-TRACKER | Tracker reconcile -yritykset, pending-intentit ja duplicate-estot | hermetic fault matrix passed 2026-08-21; live baseline not measured | SQLite v9 tracker outbox/linkit | sama reconcile-syy kahdessa Runissa tai duplicate external-ref |
| MH-POLICY | Global/local decisionit, Q/V-selected actionit, absorption ja completion | hierarchical compiler/runtime tests passed; operational values not measured | SQLite v15 scope-tagged decisions + Root terminal | compile/absorption failure tai Run ei saavuta successia |
| MH-MODEL-MISS | `outcome_miss | state_miss | acceptance_mismatch` scope/action/outcome-kohtaisesti | mismatch/out-of-contract tests passed; operational values not measured | SQLite v15 policy observations/events | sama miss kahdessa Runissa |
| MH-REWARD | Bound-only Graph potential, local terminal bonus, action cost ja outcome penalty | reward tests passed; operational values not measured | policy observation v5 ja acceptance-ledger | unbound/split/duplicate progress reward ≠ 0 tai local bonus > 1 kertaa |

## Parannusloki

| Change ID | Baseline | Hypoteesi | Ehdotettu parannus | Odotettu mitattava tulos | Hyväksyntä | Toteutunut vaikutus | Evaluation due |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MHC-001 | 4 delivery Loopia, 0 valittua project skilliä, legacy `migrated-*`-instructionit, ei jaettua architecture tracea | 6+1 capability Loops ja vakaat arc42-artefaktit vähentävät driftiä ja ambiguous handoffeja | Ota `adr-011` ja strict-v10 arc42 -graafi käyttöön | `validate:arc42` = 0 issuea; ensimmäinen pilotti sisältää täydellisen Goal→evidence-tracen eikä fallback routea | eksplisiittisesti valtuutettu 2026-08-16 | pending pilot | ensimmäisen REVIEW’n jälkeen |
| MHC-002 | Aktiiviset arkkitehtuurilähteet olivat lyhyitä ja osa Goal/support-sanastosta ristiriidassa strict-v10:n sekä nykyisen Run UI:n kanssa | Kattava suomenkielinen, trace- ja lähdeankkuroitu arc42-korpus vähentää ihmis- ja agenttitulkinnan driftiä | Toteuta `comprehensive-arc42-documentation` muuttamatta runtimea tai ADR-semanttiikkaa | 0 arc42-validointivirhettä, 8/8 Mermaid-renderöintiä, 11/11 Goal/REQ-paria tracettuna ja rajatusta legacy-hausta 0 aktiivista ristiriitaa | käyttäjän hyväksymä suunnitelma 2026-08-17 | paikalliset rakenteelliset mittarit täyttyivät; ihmis- ja pilottivaikutus pending | initiative REVIEW ja ensimmäinen pilotti |
| MHC-003 | Oletuksessa oli 11 capability Loopia, agentin flow-target-valinta, 62 flow/repair-yhteyttä ja 10 arc42-moduulia; release-taskit eivät olleet idempotentisti sovitetussa trackerissa | Viiden named RunBook -Loopin exact routing ja kaksistoreinen `tk`-sovitus tekevät toimitusjärjestyksestä ennustettavan ja toteutustyöstä restart-turvallisen | Toteuta `goal-014` / `adr-022`: DESIGN→PLAN→BUILD→DEPLOY→VERIFY, 18 transitionia, V13/V3/DB9 ja tracker outbox | TEST-016–TEST-018 läpäisevät; pilotissa 0 providerin flow-target-valintaa, 0 duplicate external-refiä ja jokainen Loop invocation jäljitettävissä | käyttäjän hyväksymä suunnitelma 2026-08-20 | local schema/runtime/hermetic/browser/final gates passed 2026-08-21; live `tk`, human visual verdict and pilot impact pending | `graph-engineering-runbook` REVIEW ja ensimmäinen VERIFY |
| MHC-004 | Accepted Graph-only `ssp_v1`, local LLM routing, PASS/FAIL-only observations ja upper-level planet canvas; calibrated priors/costs sekä oikea pilotti puuttuivat | Outcome-aware global/local `ssp_v2`, capability-first authoring ja explicit option-cost dimensions tekevät routingista tarkastettavan ja model missit kalibroitaviksi | Toteuta `goal-017`–`goal-019`, ADR-028–030, strict v17/v5/v10/v13 ja kerää MH-POLICY/MH-MODEL-MISS/MH-COST pilotissa | TEST-022–025 läpäisevät; pilotissa kaikki viisi local policya proper, yksi success Graph Run, 0 provider-routingia `ssp_v2`:ssa ja jokainen miss/cost dimension luokiteltu | project owner acceptance commit `26698dda`; calibrated pilot/Portti B pending | Phase 2 observation implementation verified locally; operational impact pending | Phase 3 calibration inputs ja ensimmäinen calibrated `ssp_v2` pilot |
| MHC-005 | Scoped agent/SSP/local-policy/Repair/promotion-malli, ristiriitainen default-dokumentaatio, outcome-riippumaton immediate reward, epoch-kohtainen uudelleenratkaisu ja 15 lint-varoitusta | Yksi Graph Reward-MDP, acceptance potential, hard authorization, once-compiled absorbing policy ja ordered Action execution pienentävät control-kompleksisuutta sekä estävät workflow-loop/release-splitting reward hackingin | Toteuta `goal-020` / `adr-031`, strict v18/v3/v6/v11/v9/v10/v11/v4/v14 ja poista superseded runtime/UI/persistence | TEST-026 läpäisee; lint warning 0; pilotissa yksi success Graph Run, duplicate acceptance reward 0 ja jokainen outcome/reward/decision traceable | project owner request 2026-08-23 | TEST-026, final repository gates ja installed browser QA passed; operational impact not measured | ensimmäinen tuotantokaltainen Reward-MDP Run |
| MHC-006 | Single Graph policy yhdisti 5 GraphNodea 62 ledger-stateen, PLANin 2 ActionNodea eivät muodostaneet local 2×2-matriisia ja node/ledger-suhde oli vaikea ymmärtää | Node-ID global/local scopet ja erillinen acceptance-portti pienentävät authorointi- ja tulkintakompleksisuutta ilman reward hackingia | Toteuta `goal-021` / `adr-033`, strict v19/v4/v7/v12/v5/v15 ja 5×5/N×N UI | TEST-027 läpäisee; default 15/25 + 3/4 + 78/144; +10 nodea ei kasvata ledgeriä; page overflow 0; pilotissa jokainen global/local päätös jäljitettävissä | project owner request 2026-08-23 | implementation, final package/startup ja desktop/narrow browser gates passed; operational impact ja ihmisusability not measured | ensimmäinen tuotantokaltainen hierarchical Run |

## Muutospolitiikka

Automaattinen korjaus rajautuu matalariskiseen rikkoutuneeseen dokumenttilinkkiin, indeksiin, formaattiin, deterministiseen lintiin tai deterministiseen testiin, kun semantiikka ei muutu. Goal-, ADR-, Loop-, permission-, network-, release/deploy-, instruction- ja skill-käyttäytymismuutokset vaativat eksplisiittisen ihmisvaltuutuksen. Jokainen menetelmämuutos kirjaa baselinen, hypoteesin, odotetun tuloksen ja myöhemmän evaluationin.

Dokumentaation kielen tai kattavuuden muutos ei itsessään muuta Loop-topologiaa, schedulea, permissionia tai agenttikäyttäytymistä. Jos dokumentaatiotyö paljastaa tällaisen tarpeen, se kirjataan findingiksi ja pysäytetään ihmisrajalle.

## Kanoniset lähteet

Runtime-lukumäärät tulevat Root Run -evidenssistä. Persistent findingit ja päätökset tulevat initiative-REVIEWistä, [TRACEABILITYsta](TRACEABILITY.md), [STATUSesta](STATUS.md) ja [osiosta 11](11-risks-and-technical-debt.md).

## Relevantit päätökset

`goal-009`, `goal-014`, `goal-018`, `goal-021`, `adr-011`, `adr-015`, `adr-022`, `adr-025`, `adr-027`, `adr-029` säilyvin osin ja `adr-033`.

## Evidenssi

Migration assessment dokumentoi ensimmäisen stale-document- ja legacy-baselinen. `graph-engineering-runbook` kirjaa MHC-003:n teknisen ja myöhemmin pilotin operatiivisen evidenssin. Runtime-countereita ei johdeta dokumenttimuutoksesta eikä keksitä.

## Avoimet kysymykset

- `OQ-002`: tuottaako ensimmäinen viiden Loopin Graph Root Run operatiiviset baselinet vai pysähtyykö se prerequisite-/authorization-rajaan?
- Vähentääkö MHC-002 todellisia review-korjauksia ensimmäisessä pilotissa vai vain dokumentin kattavuuspuutetta? Tämä arvioidaan pilotin findingeistä.

## Seuraava katselmointiperuste

Päivitä VERIFY-vaiheen ja initiative-REVIEWn jälkeen vain, kun materiaalista runtime-, tracker-, conformance- tai ihmisreview-evidenssiä on.
