---
id: arc42-method-health
title: Balletin arc42-menetelmän terveys
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - method-health
  - continuous-learning
---

# Balletin arc42-menetelmän terveys

## Tarkoitus

Tämä tiedosto seuraa evidenssiä siitä, miten kehitysmenetelmä toimii, ja sallii parannusehdotukset vain mitatun tarpeen perusteella. Se ei ole yleinen changelog eikä runtime-logien kopio.

## Tila

Mittauskontrakti on accepted. Operatiiviset arvot ovat `not measured`, kunnes ensimmäinen arc42 Root Run tuottaa runtime-evidenssin. Dokumentaatiodriftin uusi havainto on kirjattu MH-STALEen, mutta se ei muodosta end-to-end-method-baselinea.

## Terveysmittarit

| Metric ID | Mittari | Baseline | Lähde | Review-trigger |
| --- | --- | --- | --- | --- |
| MH-FAIL | Validation FAIL -määrä ja luokitellut syyt | not measured | Root Run Validation outcomes | sama syy kahdessa initiativessa |
| MH-RETRY | Local retryt Nodea ja syytä kohti | not measured | Node Run attempts | sama Node ylittää yhden retryn kahdessa Runissa |
| MH-REPAIR | Orchestrator repairit ja valitut targetit | not measured | Repair Requests ja routes | ambiguiteetti tai toistuva target mismatch |
| MH-OQ | Toistuvat open questionit | not measured | BRIEF/REVIEW ja STATUS | sama kysymys säilyy kahden review’n yli |
| MH-STALE | Vanhentuneet tai ristiriitaiset dokumenttifindingit | migration baseline: summary sisälsi legacy-faktoja; 2026-08-17 active Goal/support -lähteissä havaittiin strict-v10:n vastainen sanasto | evaluation findingit ja legacy-haku | mikä tahansa accepted source contradiction |
| MH-DRIFT | Architecture drift -findingit | not measured | conformance review | mikä tahansa high-impact unaccepted drift |
| MH-EVID | Testi- ja quality scenario -evidenssivajeet | QS-riveillä on pending pilot/release/final verification -evidenssiä | TRACEABILITY ja REVIEW | release candidate sisältää pending priority-1-QS:n |
| MH-MANUAL | Manual interventionit ja syyt | not measured | `needs_input` ja Human Node outcomes | sama vältettävä syy kahdessa Runissa |

## Parannusloki

| Change ID | Baseline | Hypoteesi | Ehdotettu parannus | Odotettu mitattava tulos | Hyväksyntä | Toteutunut vaikutus | Evaluation due |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MHC-001 | 4 delivery Loopia, 0 valittua project skilliä, legacy `migrated-*`-instructionit, ei jaettua architecture tracea | 6+1 capability Loops ja vakaat arc42-artefaktit vähentävät driftiä ja ambiguous handoffeja | Ota `adr-011` ja strict-v10 arc42 -graafi käyttöön | `validate:arc42` = 0 issuea; ensimmäinen pilotti sisältää täydellisen Goal→evidence-tracen eikä fallback routea | eksplisiittisesti valtuutettu 2026-08-16 | pending pilot | ensimmäisen REVIEW’n jälkeen |
| MHC-002 | Aktiiviset arkkitehtuurilähteet olivat lyhyitä ja osa Goal/support-sanastosta ristiriidassa strict-v10:n sekä nykyisen Run UI:n kanssa | Kattava suomenkielinen, trace- ja lähdeankkuroitu arc42-korpus vähentää ihmis- ja agenttitulkinnan driftiä | Toteuta `comprehensive-arc42-documentation` muuttamatta runtimea tai ADR-semanttiikkaa | 0 arc42-validointivirhettä, 8/8 Mermaid-renderöintiä, 11/11 Goal/REQ-paria tracettuna ja rajatusta legacy-hausta 0 aktiivista ristiriitaa | käyttäjän hyväksymä suunnitelma 2026-08-17 | paikalliset rakenteelliset mittarit täyttyivät; ihmis- ja pilottivaikutus pending | initiative REVIEW ja ensimmäinen pilotti |

## Muutospolitiikka

Automaattinen korjaus rajautuu matalariskiseen rikkoutuneeseen dokumenttilinkkiin, indeksiin, formaattiin, deterministiseen lintiin tai deterministiseen testiin, kun semantiikka ei muutu. Goal-, ADR-, Loop-, permission-, network-, release/deploy-, instruction- ja skill-käyttäytymismuutokset vaativat eksplisiittisen ihmisvaltuutuksen. Jokainen menetelmämuutos kirjaa baselinen, hypoteesin, odotetun tuloksen ja myöhemmän evaluationin.

Dokumentaation kielen tai kattavuuden muutos ei itsessään muuta Loop-topologiaa, schedulea, permissionia tai agenttikäyttäytymistä. Jos dokumentaatiotyö paljastaa tällaisen tarpeen, se kirjataan findingiksi ja pysäytetään ihmisrajalle.

## Kanoniset lähteet

Runtime-lukumäärät tulevat Root Run -evidenssistä. Persistent findingit ja päätökset tulevat initiative-REVIEWistä, [TRACEABILITYsta](TRACEABILITY.md), [STATUSesta](STATUS.md) ja [osiosta 11](11-risks-and-technical-debt.md).

## Relevantit päätökset

`goal-009`, `adr-011` ja `adr-015`.

## Evidenssi

Migration assessment dokumentoi ensimmäisen stale-document- ja legacy-baselinen. `comprehensive-arc42-documentation` kirjaa uuden rajatun findingin sekä final verification -tulokset. Runtime-countereita ei johdeta dokumenttimuutoksesta eikä keksitä.

## Avoimet kysymykset

- `OQ-002`: mikä ensimmäinen initiative tuottaa operatiiviset baselinet?
- Vähentääkö MHC-002 todellisia review-korjauksia ensimmäisessä pilotissa vai vain dokumentin kattavuuspuutetta? Tämä arvioidaan pilotin findingeistä.

## Seuraava katselmointiperuste

Päivitä Evaluate Loopista initiativen jälkeen tai scheduled continuous learningista vain, kun materiaalista evidenssiä on.
