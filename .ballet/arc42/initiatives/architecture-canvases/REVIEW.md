---
id: arc42-initiative-architecture-canvases-review
title: Architecture canvases initiative review
status: draft
createdAt: '2026-08-17'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - initiative
  - review
  - canvas
---

# Architecture canvases — REVIEW

## Tarkoitus ja tila

Arvioida kolmen canvasin toimitus BRIEFiä, PLANia, kanonista arkkitehtuuria ja paikallista evidenssiä vasten. Review on `draft`, eikä projektin omistaja ole vielä hyväksynyt sisältöä.

## Yhteenveto

Kolme pyydettyä Markdown + Mermaid -canvasia, arc42-indeksilinkit, persistent handoff ja initiative-ketju on toimitettu. Ensimmäinen proosapainotteinen versio läpäisi rakennetarkistukset mutta epäonnistui käyttäjän tarkoittamassa visuaalisessa scanabilityssa. V2 lisää jokaisen dokumentin alkuun renderöidyn korttiruudukon ja säilyttää pitkän Markdownin perustelu-/fallback-kerroksena. Paikallinen verdict on **conformant with notes**: korjattu acceptance- ja repository-ketju läpäisee, mutta projektin omistajan uusi sisältöhyväksyntä sekä business-/usability-hyötyevidenssi puuttuvat tarkoituksella.

## Päätökset ja löydökset

- **Ihmispäätökset:** DEC-CANVAS-001 valtuuttaa kolmen canvasin luonnin; DEC-CANVAS-002 palauttaa v1:n ja vaatii korttimaisen Markdown + Mermaid -esityksen.
- **Fakta / FACT-CANVAS-002:** toimitetut artefaktit ovat kolme canvasia, kaksi indeks/status-päivitystä ja tämän initiativen neljä draft-tiedostoa (CANVAS-EVID-004, CANVAS-EVID-006).
- **Hyväksymispäätös:** pending; vain projektin omistaja voi vaihtaa initiativen hyväksytyksi.
- **Oletus / ASM-CANVAS-001:** vahvistettu 2026-08-17 virallisista lähdesivuista; local heading-check vastaa 12 + 9 + 8 elementtiä (CANVAS-EVID-001–003).
- **Hypoteesi / HYP-CANVAS-001:** avoin. Artefaktit ovat olemassa, mutta perehdytys- tai keskusteluajan paranemista ei ole mitattu.
- **Löydös / FIND-CANVAS-001:** ei architecture driftia. Diffi ei muuta Goaleja, ADR:iä, 12 accepted osiota, project configia, designia, API:a, schemaa tai runtimea; canvasit ilmaisevat johdetun omistajuutensa (CANVAS-EVID-004–008).
- **Löydös / FIND-CANVAS-002:** Inception Canvasin puuttuva talous-, pilot-, usability-, host-loss- ja compliance-evidenssi on merkitty avoimeksi tiedoksi eikä muunnettu toteutus- tai hyväksymisväitteeksi (CANVAS-EVID-003, CANVAS-EVID-008).
- **Löydös / FIND-CANVAS-003:** syntaktisesti ja sisällöllisesti oikea Markdown ei yksin täyttänyt canvasin visuaalista käyttötarkoitusta. Historiallinen CANVAS-EVID-009 on `failed`; v2:n Mermaid-ruudukot, CLI-renderöinti, visual review ja card-to-canon review korjaavat nykyisen toteutuksen (CANVAS-EVID-010–012).

## Hyväksymisverdictit

| Kriteeri | Evidenssi | Verdict | Huomio |
| --- | --- | --- | --- |
| ACPT-CANVAS-001 | CANVAS-EVID-001–002, CANVAS-EVID-010–012 | passed | Kaikki 12 elementtiä näkyvät 12-korttisena pikayhteenvetona ja yksityiskohtina; sizing, trust boundaryt ja tunnetut aukot säilyvät. |
| ACPT-CANVAS-002 | CANVAS-EVID-001, CANVAS-EVID-003, CANVAS-EVID-010–012 | passed | Kaikki 9 elementtiä näkyvät kortteina sekä BB-, ADR- ja QS-linkityksinä ilman päätöstekstin kopiointia. |
| ACPT-CANVAS-003 | CANVAS-EVID-001, CANVAS-EVID-003, CANVAS-EVID-010–012 | passed | Kaikki 8 elementtiä näkyvät kortteina; top-3-laatu ja HYP-AIC-001–006 pysyvät erillään faktoista/päätöksistä. |
| ACPT-CANVAS-004 | CANVAS-EVID-004 | passed | Kaikki uudet artefaktit ovat `draft`, omistajuus ja päivitystriggerit on ilmaistu ja indeksi ratkaisee linkit. |
| ACPT-CANVAS-005 | CANVAS-EVID-005–007 | passed | Arc42-validation, kenttä-/linkki-/source-/scope-tarkistus ja diff hygiene läpäisevät. |
| ACPT-CANVAS-006 | CANVAS-EVID-009–012 | passed after repair | V1:n ihmisreview epäonnistui; v2:n kolme Mermaid-lohkoa renderöityvät SVG:ksi, tarkastetut PNG-preview't ovat korttimaisia, sans-serif-tyylisiä ja leikkaamattomia ja korttien väitteet vastaavat kanonisia lähteitä. |

## QS-verdictit

| QS | Vaikutus ja verdict | Evidenssi / raja |
| --- | --- | --- |
| QS-002 / QS-011 | `conformant`: canvasit kuvaavat explicit resource/composition -rajan muuttamatta snapshot-, prompt-, hash-, queue- tai adapterisopimusta. | CANVAS-EVID-002, CANVAS-EVID-006; aiempi runtime-evidenssi pysyy osiossa 10. |
| QS-005 | `passed`: repositoryssa on yksi ratkaistava source of truth, 44 uniikkia dokumentti-ID:tä ja nolla broken local linkkiä. | CANVAS-EVID-004–007. |
| QS-013 | `conformant`: Communication/Inception Canvas linkittää canonical Run-projektion eikä lisää progress-, ETA- tai provider-derived-state-väitettä. | CANVAS-EVID-003, CANVAS-EVID-008; ei UI-muutosta. |

## Arkkitehtuurivaikutus

Toteutunut vaikutus on Markdown + Mermaid -kommunikaatiokerros BB-008:n sisällä. Uutta runtime-, deployment-, API-, persistence-, provider-, module- tai tuote-UI-ratkaisua ei syntynyt. Canvasit projisoivat accepted STRAT-/BB-/RT-/DEP-/CON-/QS-/RISK-lähteitä ja ohjaavat yksityiskohdan takaisin niiden omistajalle. Diagrammien värit ja typografia käyttävät `DESIGN.md`:n tokeneita muuttamatta itse design-järjestelmää.

## Riskit, TRACEABILITY ja METHOD-HEALTH

- Section 11 -päivitystä ei tarvita: FIND-CANVAS-001–002 ei lisää project-tason riskiä, vaan projisoi jo tunnetut riskit ja puuttuvan evidenssin.
- TRACEABILITY-päivitystä ei tarvita: uusia Goal/REQ/QS/test/evidence-ketjuja ei luotu.
- METHOD-HEALTH-päivitystä ei tehdä: HYP-CANVAS-001:stä ei syntynyt uutta menetelmän käyttöevidenssiä.

## Avoimet kysymykset

- OQ-CANVAS-001: projektin omistajan sisältöhyväksyntä.
- OQ-CANVAS-002: mahdollinen business-case- ja canvas-käytettävyysbaseline.

## Handoff

- Nykyinen status: `draft`, v1 palautettu ja v2:n visuaalinen korjaus sekä paikallinen conformance review valmis.
- Pyydetty outcome: projektin omistaja arvioi kaikki kolme canvasia ja hyväksyy tai palauttaa ne.
- Seuraava hyväksytty toimi: projektin omistajan uusi ihmisarvio OQ-CANVAS-001:stä korttiruudukoiden perusteella.
- Stop condition: commit, merge, push, release, deploy ja muu ulkoinen kirjoitus vaativat erillisen täsmällisen valtuutuksen.

## Seuraava katselmointiperuste

Sulje tai vaihda status vasta projektin omistajan hyväksynnän jälkeen. Uusi Goal/ADR- tai source-muutos avaa canvasien synkronointitarpeen niiden päivitystriggerien mukaisesti.
