---
id: arc42-initiative-architecture-canvases-plan
title: Architecture canvases initiative plan
status: draft
createdAt: '2026-08-17'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - initiative
  - plan
  - canvas
---

# Architecture canvases — PLAN

## Tarkoitus ja tila

Toteuta [BRIEFin](BRIEF.md) kolme johdettua canvas-projektiota muuttamatta hyväksyttyä arkkitehtuuria. Suunnitelma on `draft`, eikä se valtuuta releasea, deployta tai muuta ulkoista kirjoitusta.

## Toteutussuunnitelma

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CANVAS-step-001 | goal-001–goal-011 / REQ-001–REQ-011 | QS-002, QS-005 | ADR-011, CON-007 | BB-008 | — | Viralliset canvas-sivut; nykyinen arc42-, Goal-, ADR- ja source-korpus | Kenttälistojen manuaalinen vertailu virallisiin lähteisiin | CANVAS-EVID-001 |
| CANVAS-step-002 | REQ-001–REQ-010 | QS-001, QS-002, QS-011, QS-012 | ADR-001–ADR-016 soveltuvin osin | BB-001–BB-009 | RT-001, RT-008, RT-010 / DEP-001–DEP-003 | `canvases/TECH-STACK-CANVAS.md`, package/build/release metadata | 12 headingin ja version/source-ankkureiden tarkistus | CANVAS-EVID-002 |
| CANVAS-step-003 | REQ-001–REQ-011 | QS-005, QS-010, QS-013 | ADR-011, ADR-017, CON-005–CON-007 | BB-001–BB-009 | RT-001–RT-010 / DEP-001–DEP-003 | Communication- ja Inception-canvas; osiot 1–11 | 9 + 8 headingin, top-3-laadun ja hypoteesiluokituksen tarkistus | CANVAS-EVID-003 |
| CANVAS-step-004 | REQ-009 | QS-005 | ADR-011, CON-007 | BB-008 | — | `arc42/README.md`, `STATUS.md`, initiative BRIEF/PLAN/EVIDENCE/REVIEW | Linkki-, stable ID-, status- ja ownership-tarkistus | CANVAS-EVID-004 |
| CANVAS-step-005 | REQ-009 | QS-005 | ADR-011 | BB-008 | — | Kaikki tämän initiativen diffipolut | `npm run validate:arc42`, suojattujen polkujen diffi ja `git diff --check` | CANVAS-EVID-005–007 |
| CANVAS-step-006 | REQ-009 | QS-005 | ADR-011 | BB-008 | — | Initiative REVIEW ja persistent handoff | Bounded conformance review BRIEF/PLAN/diff/evidenssiä vasten | CANVAS-EVID-008 |
| CANVAS-step-007 | REQ-007, REQ-009 | QS-005, QS-013 | ADR-011, ADR-017, CON-005, CON-006 | BB-001, BB-008 | — | Kolmen canvasin ensimmäiset Mermaid-lohkot; `DESIGN.md` | Mermaid CLI 11.12.0 SVG-renderöinti, renderöityjen korttien visuaalinen tarkastus ja card-to-canon conformance review | CANVAS-EVID-009–012 |

## Järjestys ja riippuvuudet

1. Varmista virallisten mallien kentät ja nykyisen korpuksen kanoniset faktat.
2. Laadi Tech Stack Canvas package-, build-, deployment- ja source-evidenssistä.
3. Laadi Communication Canvas nykyisestä arc42-synteesistä ja Inception Canvas retrospektiivisenä hypoteesinäkymänä.
4. Linkitä canvasit arc42-indeksiin ja päivitä yksi persistent handoff.
5. Renderöi kaikki kolme korttiruudukkoa väliaikaisiksi SVG-/PNG-tarkistuksiksi, korjaa fontti-, leikkaus- ja mittasuhdeongelmat ja jätä renderit commitin ulkopuolelle.
6. Aja repository-tarkistukset, tee conformance review ja jätä kaikki initiative-artefaktit `draft`-tilaan.

## Muuttuvat polut

- `.ballet/arc42/canvases/*.md`
- `.ballet/arc42/README.md`
- `.ballet/arc42/STATUS.md`
- `.ballet/arc42/initiatives/architecture-canvases/*.md`

## Riskit ja kontrollit

| Riski | Kontrolli |
| --- | --- |
| Canvasista syntyy rinnakkainen päätöslähde. | Johdetun projection rooli, linkitys kanonisiin lähteisiin ja no-new-decision conformance review. |
| Retrospektiivinen inception-kuvaus esittää oletuksen faktana. | Vakaa `HYP-AIC-*`-luokitus, evidence/status-sarake ja puuttuvan tiedon eksplisiittinen nimeäminen. |
| Teknologiaversio vanhenee. | Versiot ankkuroidaan `package.json`:iin/release workflow'hun ja päivitystriggeri kirjataan. |
| Yhden sivun canvas paisuu symbolikatalogiksi. | Pysy arkkitehtuuritason vastuissa ja linkitä whitebox-/source-detailit kanonisiin osioihin. |
| Rakenteellisesti oikea Markdown ei näytä kortticanvasilta. | Mermaid `block` -ruudukko dokumentin alkuun, 3–4 lyhyttä riviä/kortti ja visual render review. |
| Mermaid-renderer ei tue `block`-syntaksia tai diagrammikohtaista CSS:ää. | Mermaid CLI 11.12.0 on verifioitu baseline; yksityiskohtainen Markdown jää tekstifallbackiksi. |
| Dokumenttilinkki tai stable ID rikkoutuu. | `validate:arc42`, kohdennettu heading/link-check ja `git diff --check`. |

## Migrations, rollback ja yhteensopivuus

Ei data-, API-, runtime-, package- tai database-migraatiota. Dokumenttimuutos on Git-diffillä palautettavissa. Canvasien poisto ei muuta runtimea, mutta niiden indeksilinkit on silloin poistettava samassa muutoksessa.

## Legacy ja non-goals

Työ ei lisää legacy-aliasia tai rinnakkaista formaattia. Se ei siivoa muiden dokumenttien sisältöä, muuta hyväksyttyä Goal/ADR-tekstiä eikä refaktoroi lähdekoodia.

## Tarkistukset

```text
npm run validate:arc42
canvasien official-heading/link/source-tarkistus
Mermaid CLI 11.12.0: kaikkien kolmen ensimmäisen mermaid-lohkon SVG-renderöinti
renderöityjen PNG-preview'iden visuaalinen fontti/leikkaus/ruudukkotarkistus
git diff --name-only -- .ballet/goals .ballet/adr .ballet/project.json DESIGN.md backend frontend shared
git diff --check
```

## Avoimet kysymykset

Projektin omistajan sisältöhyväksyntä jää OQ-CANVAS-001:ksi. Tekninen toteutus ei tarvitse lisävalintaa, jos viralliset kentät ja nykyiset kanoniset lähteet ovat yksiselitteisiä.

## Seuraava katselmointiperuste

Ready for conformance review, kun CANVAS-step-001–005 on tehty ja jokaisen hyväksymiskriteerin konkreettinen evidenssi on kirjattu.
