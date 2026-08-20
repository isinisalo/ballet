---
id: arc42-section-04
title: Ratkaisustrategia
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-20'
version: 10
tags:
  - arc42
  - solution-strategy
arc42Section: 4
---

# 4. Ratkaisustrategia

## Tarkoitus

Tämä osio kokoaa perustavat ratkaisut, joilla Ballet vastaa Goaleihin, laatutavoitteisiin ja rajoitteisiin. Hyväksytyn päätöksen koko perustelu säilyy ADR:ssä; tässä kuvataan valintojen yhteisvaikutus ja todennettava seuraus.

## Tila

STRAT-001–STRAT-009 ovat toteutetun arkkitehtuurin strategioita. STRAT-010:n strict-v12/v2 Workflow hard cut on toteutettu teknisesti; ihmisacceptance, menetelmän vaikuttavuuden tuotantokaltainen baseline ja UI:n pidempiaikainen tulkintavirheiden seuranta ovat vielä avointa evidenssiä.

## Strategiat ja jäljitettävyys

| ID | Strategia | Goal / REQ | QS | ADR / rajoite | Todennettava seuraus |
| --- | --- | --- | --- | --- | --- |
| STRAT-001 | Yksi checkout-local Node/TypeScript-palvelu, React UI ja shared strict contracts. | goal-001 / REQ-001 | QS-001 | adr-001, adr-003, CTR-001, CTR-003 | Palvelu ei tarvitse tiliä tai remote control planea; UI ja backend jakavat validoidut sopimukset. |
| STRAT-002 | Versionhallittu project intent erotetaan `.git/ballet` runtime-statesta. | goal-002, goal-006 / REQ-002, REQ-006 | QS-002, QS-012 | adr-002, adr-007, CTR-004 | Projektitotuus on katselmoitava; restart käyttää vain commitoituja machine-local-faktoja. |
| STRAT-003 | Root Run käyttää immutable snapshotia ja erillistä Git-branch/worktree-paria. | goal-005 / REQ-005 | QS-004 | adr-006, CTR-005, CTR-008 | Active checkout ei muutu Node-suorituksessa eikä tulosta integroida automaattisesti. |
| STRAT-004 | Provider-neutral adapterit sekä eksplisiittiset `ExecutionProfile`-, instruction- ja skill-resurssit. | goal-003 / REQ-003 | QS-011 | adr-005, adr-012, adr-013, CTR-009 | Sama snapshot ja Task Envelope tuottavat saman tehtävän; fallbackia tai ambient resurssia ei ole. |
| STRAT-005 | Strict Workflow-runtime, revisionoitu State ja capability repair call/return. | goal-004, goal-006 / REQ-004, REQ-006 | QS-003, QS-012 | adr-015, adr-020 | Ohjausvirta, retry, repair, return ja finalization perustuvat commitoituihin tapahtumiin. |
| STRAT-006 | arc42 on pitkäikäinen totuus ja yhden vastuun project-local Ballet Loops jatkuva menetelmä. | goal-009 / REQ-009 | QS-005, QS-006, QS-008 | adr-011, adr-019, CTR-006, CTR-007 | Muutos etenee specification clarificationista erillisten strategy-, structure-, concept-, decision-, communication-, implementation- ja evaluation-capabilityjen kautta evidenssiin ilman runtime-logien kopiointia dokumentteihin. |
| STRAT-007 | Intentio, merkittävä päätös ja ulkoinen kirjoitus pysähtyvät eksplisiittiseen ihmisrajaan. | goal-005, goal-009 / REQ-005, REQ-009 | QS-004, QS-006 | adr-011, CTR-007, CTR-008 | Agentti palauttaa `needs_input` tai odottaa valtuutusta eikä päättele lupaa testituloksesta. |
| STRAT-008 | Yhden Loopin strict authoring package materialisoidaan inspect/plan/commit-vaiheissa olemassa oleviksi project-local-primitiveiksi. | goal-010, goal-011 / REQ-010, REQ-011 | QS-009, QS-010 | adr-016, adr-017, CTR-011 | Reuse ei lisää live registry- tai runtime-riippuvuutta; authoring-projektiot säilyttävät runtime-semantikan. |
| STRAT-009 | Strict-v11 graph erottaa project-global Graph Engineeringin selected-Loop-only Loop Engineeringistä ja ohjaa kaikki cross-Loop-flow/repair-valinnat snapshotattujen route-candidatejen sekä capabilityjen kautta Orchestratorille. | goal-012 / REQ-012 | QS-014 | adr-018 | V11 hard cut on poistanut Context/numeric-route/compatibility-polut; ambiguity tai ihmisvaltuutus tuottaa `needs_input`, ja UI projisoi yhden Orchestrator-control-noden, persisted policyt ja canonical Run -evidenssin ilman client-owned topologiaa. |
| STRAT-010 | Strict-v12/v2 korvaa selected-Loop-compositen `ProjectWorkflow`-mallilla, jossa Job/Validation-paritus, Pass/Fail Edget ja retry/repair-siirtymät ovat eksplisiittisiä ja validoitavia. | goal-013 / REQ-013 | QS-015 | adr-020 | Aktiivisia WorkLoopNode/WorkNode/mode/view=loop-polkuja on 0; Workflow PASS käynnistää vasta sen jälkeen Orchestrator-ohjatun Graph flow'n, ja v7-kanta failaa suljetusti. |

## Keskeiset trade-offit

| Valinta | Saatu hyöty | Hyväksytty kustannus tai raja |
| --- | --- | --- |
| Checkout-local monoliitti | Vähäinen operointipinta, selkeä trust boundary ja yhteiset sopimukset. | Ei keskitettyä monen checkoutin hallintaa eikä selainkäyttöä verkon yli. |
| SQLite runtime-totuutena | Atominen paikallinen persistence ja restart-recovery ilman infrastruktuuria. | Ei jaettua HA-kantaa; yksi checkout on operatiivinen yksikkö. |
| Sekventiaalinen Root Run | Yksiselitteinen State-, repair- ja control-flow-järjestys. | Yhden Runin sisällä ei maksimoida rinnakkaisuutta; rinnakkaisuus syntyy provider-kohtaisista kaistoista eri työtehtäville. |
| Strict composition ja ei fallbackia | Promptin provenance, toistettavuus ja virheen havaittavuus. | Konfiguraatiovirhe pysäyttää työn sen sijaan, että järjestelmä yrittäisi “parasta arvausta”. |
| Immutable snapshot | Run on selitettävissä myöhemmistä checkout-muutoksista riippumatta. | Käynnissä oleva Run ei omaksu config-muutosta ilman uutta Runia. |
| Project-local method | Workflow on versionhallittu, muokattava ja irti platform-releaseistä. | Jokainen projekti vastaa oman menetelmädatansa laadusta ja validoinnista. |
| Kanoniseen dataan perustuva UI | Operaattorin tulkinta vastaa runtime-faktoja. | Koristeellista progressia, ETA:a tai provider-tekstistä pääteltyä tilaa ei näytetä. |
| V11 hard cut | Graph-, capability-, runtime- ja UI-semanttiikalle jää yksi strict totuus ilman compatibility-matriisia. | Domain, snapshot, persistence, API, module-data ja UI on muutettava yhdessä ennen acceptancea. |
| V12 Workflow hard cut | Job/Validation-rakenne, Pass/Fail-reitit ja UI vastaavat samaa mallia ilman composite- tai mode-semanttiikkaa. | Repository-data ja SQLite-skeema muuttuvat koordinoidusti; v7-kanta arkistoidaan ennen uuden kannan luontia. |

## Arkkitehtuurin toteutusjärjestys

Konteksti ja vaatimukset määräävät luottamusrajat. Building block -rakenne toteuttaa rajat, runtime-skenaariot todentavat ohjausvirran ja poikkileikkaavat konseptit määräävät yhteiset invariantit. QS-skenaariot ja trace-ketjut toimivat hyväksymisenä. Uusi toteutus ei saa oikaista tätä ketjua lisäämällä project workflow -tietoa platform-koodiin.

## Kanoniset lähteet

Hyväksytyt ADR:t omistavat päätökset; tämä osio omistaa niiden strategisen synteesin. Goalit omistavat tavoitteen ja [osio 10](10-quality-requirements.md) mittarit.

## Relevantit päätökset

`adr-001`–`adr-003`, `adr-005`–`adr-009` ja `adr-011`–`adr-020`.

## Evidenssi

Nykyinen lähdekoodi ja testit toteuttavat STRAT-001–STRAT-010:n teknisen pinnan. `validate:arc42` tarkastaa STRAT-006:n rakenteen ja strict-v12 Workflow/Graph/capability-sopimuksen. Module-testit todentavat STRAT-008:n target-riippumattoman materialisointirajan. STRAT-009:n historiallinen tekninen evidenssi on `GLE-EVID-002`–`GLE-EVID-008`; STRAT-010:n evidenssi indeksoidaan `EVID-015`:ssä. Initiative-kohtaiset vaikutusmittarit pysyvät omissa EVIDENCE/REVIEW-tiedostoissaan.

## Avoimet kysymykset

- Osoittaako ensimmäinen end-to-end-pilotti, että ihmisrajat ovat riittäviä ilman tarpeetonta toistoa?
- Miten usein operaattorit tarvitsevat selitystä Run-kartan koristeellisten ja semanttisten elementtien erosta?

## Seuraava katselmointiperuste

Katselmoi osio, kun tärkein laatutavoite muuttuu, uusi ADR muuttaa perustavaa ratkaisua tai evaluation osoittaa, ettei strategia tuota nimettyä QS-vastetta.
