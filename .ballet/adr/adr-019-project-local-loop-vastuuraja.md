---
id: adr-019
title: Project-local Loopin yhden vastuun ja yhden onnistumisrajan sopimus
status: accepted
createdAt: '2026-08-20T00:00:00.000Z'
updatedAt: '2026-08-20T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - loop-engineering
  - loop-moduulit
  - project-local
version: 1
---

# Project-local Loopin yhden vastuun ja yhden onnistumisrajan sopimus

## Konteksti

`goal-012` ja `adr-018` edellyttävät, että Graph Engineeringin yksi LoopNode vastaa yhtä selkeästi nimettyä ohjelmistokehitystehtävää. Nykyinen `arc42-design-structures` tuottaa samalla capability-rajalla solution strategyn, Building Block View'n sekä architecture-significant runtime/deployment -kuvaukset. `arc42-design-concepts` yhdistää vastaavasti crosscutting concept -suunnittelun ja ihmisomisteisen ADR-päätösportin. Tämä tekee done-conditionista, evidenssistä, capability-yhteensopivuudesta ja yhden Loopin package-rajasta liian karkeita.

Päätöstä ohjaavat `goal-010`, `goal-012`, QS-009, QS-014, ADR-016, ADR-018, CON-007, BB-003, BB-008, BB-009, RT-006, RT-007 ja RT-011. Käyttäjä hyväksyi tämän päätöksen eksplisiittisesti Vaihe 6 -toimeksiannossa 2026-08-20.

## Vaihtoehdot

1. Säilytetään suuret arc42-vaihe-Loopit ja täsmennetään vain nimet. Hylätty: capability ja terminal completion eivät edelleenkään erottaisi erillisiä canonical outputeja.
2. Lisätään alitehtävä-capabilityt yhden Loopin sisään. Hylätty: project-global Graph ei voisi vaihtaa tai reitittää vastuuta itsenäisesti, ja package säilyisi usean vastuun kokonaisuutena.
3. Materialisoidaan jokainen architecture-significant vastuu omaksi project-local Loopiksi ja yhden Loopin packageksi; Graph koostaa flow- ja repair-yhteydet capabilityillä. Valittu.

## Päätös

### Yksi vastuu ja yksi measurable done-condition

Jokaisella project-local Loopilla ja starter packageilla on:

- yksi nimetty software-engineering-vastuu;
- yksi terminal completionin kuvaama, taskissa ja validationissa havaittava done-condition;
- yksi rajattu `capabilities.accepts`- ja yksi `capabilities.provides`-raja;
- oma Work/Validation-kompositio;
- vain vastuun tarvitsemat instruction- ja skill-resurssit; sekä
- eksplisiittinen State-contract, package identity ja provenance/hashi install/export-ketjussa.

Usea Work Loop Node sallitaan vain, kun ne ovat saman vastuun sisäisiä vaiheita ja sama terminal done-condition kattaa ne kaikki. Erillinen canonical output, erillinen ihmisomisteinen päätös tai itsenäisesti vaihdettava capability on oma Loop.

### Project-local arc42-pilkkominen

`arc42-design-structures` korvataan solution strategy-, Building Block View- ja architecture-significant runtime/deployment -Loopeilla. `arc42-design-concepts` korvataan crosscutting concept- ja architecture decision -Loopeilla. Jokainen näistä materialisoituu omaksi yhden Loopin packageksi.

Muiden arc42-Loopien sisäinen monivaiheisyys säilyy vain, kun Loopin kuvaus, taskit, validation ja capability osoittavat yhden yhteisen done-conditionin. Nykyinen `Arc42MethodStateV1` säilyy yhteensopivana; sitä ei kopioida uudeksi State-versioksi ilman rakenteellista tarvetta.

### Starter library ja vaihdettavuus

Project-local library voi sisältää omistajan esimerkkialueiden rajattuja startereita, kuten specification clarification, solution strategy, architecture decision, UI mock, UI design, implementation ja deploy to dev environment. Nimet ja capabilityt ovat project-local dataa, eivät platform-vocabularya.

Kaksi pakettia voi tarjota saman capabilityn. Target voidaan vaihtaa Graphin edge-datassa toiseen yhteensopivaan Loopyyn muuttamatta source Loopin taskia, instructionia, skilliä, State-contractia tai packagea.

### Topologia- ja target-raja

Kaikki flow- ja repair-topologia säilyy `.ballet/project.json`-graphissa. Package, task, instruction, skill, State-contract tai outcome ei saa nimetä peer/upstream/downstream/repair-target Loop ID:tä eikä sisältää project-global Graphia. `recommendedConnections` on capability-suositus, ei persisted edge eikä Orchestrator-valinta.

Platformin generic package-, install-, export-, provenance-, hash-, capability- ja conformance-primitivet eivät tunne project-workflow-ID:itä.

## Supersession-raja

Tämä ADR supersedoi `adr-011`:stä vain kiinteän kuuden nimetyn arc42-aktiviteetti-Loopin listan ja oletus-flow'n sellaisena kuin se yhdistää useita itsenäisiä vastuita. ADR-011:n kanoniset polut, yhteinen State-sopimus, capability-repair, ihmisrajat, jatkuva oppiminen, source-of-truth ja platform/project-erottelu säilyvät hyväksyttyinä.

ADR-016:n yhden Loopin package/materialisointi ja ADR-018:n Graph/Loop/Orchestrator-semanttiikka säilyvät; tämä päätös tarkentaa niiden project-local responsibility-granulariteetin.

## Seuraukset

- Project Graph saa enemmän LoopNodeja ja capability-edgejä, mutta jokaisen noden completion on yksiselitteisempi.
- Starter package -määrä kasvaa; yhden paketin tarkastus-, install-, export-, provenance- ja hash-raja pysyy muuttumattomana.
- Arc42-validatorin project-local flow/repair-odotukset ja dokumentoitu 6+1-sanasto on päivitettävä.
- Historiallisia Goal-, ADR- tai evidence-tiedostoja ei kirjoiteta uudelleen.
- Uutta platform-schemaa tai runtime-entiteettiä ei tarvita.

## Evidenssi ja review trigger

Toteutusankkurit ovat `.ballet/project.json`, `.ballet/loop-library/**`, `.ballet/instructions/**`, `.agents/skills/**`, `scripts/generate-arc42-loop-library.ts`, Loop module -smoke-testit ja initiative `graph-and-loop-engineering` / `GLE-EVID-008A`.

Päätös arvioidaan uudelleen, jos yhden vastuun Loopit lisäävät mitattavasti route-ambiguityä, State-contractit eivät säily yhteensopivina, tai jokin vastuu tarvitsee packageen project-global topologiaa tai peer-ID:tä.
