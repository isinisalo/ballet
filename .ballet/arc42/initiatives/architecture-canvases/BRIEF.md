---
id: arc42-initiative-architecture-canvases-brief
title: Architecture canvases initiative brief
status: draft
createdAt: '2026-08-17'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - initiative
  - brief
  - canvas
---

# Architecture canvases — BRIEF

## Tarkoitus

Luoda Balletista kolme ajantasaista, suomenkielistä ja kanonisiin lähteisiin jäljitettävää Markdown + Mermaid -canvasia: Tech Stack Canvas, Architecture Communication Canvas ja Architecture Inception Canvas. Jokaisen ensisijainen näkymä on korttimainen pikayhteenveto; yksityiskohtainen Markdown toimii sen perustelu- ja lähdekerroksena.

## Initiative

| Kenttä | Arvo |
| --- | --- |
| Initiative ID | `architecture-canvases` |
| Omistaja | Projektin omistaja |
| Tila | `draft` |
| Goal / REQ | `goal-001`–`goal-011` / REQ-001–REQ-011; viittaus vain, ei WHAT/WHY-muutosta |
| Päälaatu | QS-002, QS-005, QS-011 ja QS-013: jäljitettävyys, determinismi ja canonical projektio |

## Fakta

`FACT-CANVAS-001`: Balletilla on hyväksytty 12-osioinen arc42-korpus, Goal- ja ADR-omistajuus, nykyistä työpuuta kuvaavat building block/runtime/deployment-näkymät sekä teknologioiden toteutuslähteet. Ennen tätä initiativea `.ballet/arc42/` ei sisältänyt kolmea pyydettyä canvas-projektiota.

## Ihmispäätös

`DEC-CANVAS-001`: projektin omistaja pyysi 2026-08-17 luomaan Balletista Tech Stack Canvasin, Architecture Communication Canvasin ja Architecture Inception Canvasin ja antoi niiden viralliset lähde-URL:t. Pyyntö valtuuttaa dokumenttien ja niiden paikallisen initiative-/indeksievidenssin luonnin, ei Goal-, ADR-, schema-, runtime-, UI-, release- tai repositoryn ulkoista muutosta.

`DEC-CANVAS-002`: projektin omistaja palautti alkuperäiset proosapainotteiset Markdown-versiot 2026-08-17, koska ne eivät näyttäneet korteilta eivätkä antaneet riittävän nopeaa visuaalista yhteenvetoa. Korjattu formaatti on repository-native Markdown + Mermaid `block` -korttiruudukko. AsciiDocia ei oteta rinnakkaiseksi lähdeformaatiksi, koska se ei yksin ratkaise visualisointia ja lisäisi toisen dokumenttityökaluketjun.

## Sidosryhmät ja odotukset

| Sidosryhmä | Odotus |
| --- | --- |
| Projektin omistaja | Tunnistaa intentin, rajat, puuttuvan tiedon ja hyväksymistä vaativat kohdat ilman teknologian keksimistä. |
| Arkkitehti | Saa yhdestä paikasta stackin, kommunikaatiorakenteen, inception-hypoteesit ja linkit kanoniseen perusteluun. |
| Kehittäjä / AI-agentti | Näkee vastuut, rajapinnat, teknologiat, invariantit ja lähdekoodiankkurit ilman symbolikatalogia. |
| Operaattori / ylläpitäjä | Näkee runtime-, deployment-, recovery-, observability- ja authority-rajat. |
| Katselmoija | Pystyy erottamaan hyväksytyn päätöksen, toteutetun faktan, hypoteesin, puuttuvan tiedon ja avoimen riskin. |

## Scope

- Luo `.ballet/arc42/canvases/TECH-STACK-CANVAS.md` virallisen 12 elementin pohjalta ja näytä kaikki 12 tiiviinä Mermaid-kortteina ennen yksityiskohtia.
- Luo `.ballet/arc42/canvases/ARCHITECTURE-COMMUNICATION-CANVAS.md` virallisen yhdeksän elementin pohjalta ja näytä kaikki yhdeksän korttiruudukkona.
- Luo `.ballet/arc42/canvases/ARCHITECTURE-INCEPTION-CANVAS.md` virallisen kahdeksan elementin pohjalta retrospektiivisenä nykytilan inception-näkymänä ja näytä kaikki kahdeksan korttiruudukkona.
- Linkitä canvasit arc42-indeksiin ja päivitä persistent status/handoff.
- Kirjaa suunnitelma, evidenssi ja conformance review tämän initiativen alle.

## Non-goals

- Ei uutta Goal-, REQ-, QS-, ADR-, BB-, RT-, DEP-, CON-, riski- tai schema-päätöstä.
- Ei muutoksia `.ballet/project.json`:iin, `DESIGN.md`:ään, runtime-/frontend-koodiin, tietokantaan tai API-/TypeScript-sopimuksiin.
- Ei talous-, käyttäjä-, kapasiteetti-, compliance- tai tuotantoevidenssin keksimistä.
- Ei commitia, mergeä, pushia, releasea, deployta, rollbackia tai muuta ulkoista kirjoitusta.

## Rajoitteet ja kontekstirajat

- Canvasit ovat johdettuja projektioita; ristiriidassa Goal, ADR, arc42-osio, package metadata tai lähdekoodi voittaa omistajuutensa mukaisesti.
- Aktiivinen proosa kirjoitetaan suomeksi, mutta stable ID:t ja vakiintuneet Ballet-/lähdekooditermit säilyvät.
- Architecture Inception Canvas ei saa esittää retrospektiivistä hypoteesia hyväksyttynä päätöksenä.
- Mermaid-kortit käyttävät `DESIGN.md`:n dark-only-värejä, Inter/Arial-sans-serif-typografiaa ja pehmeästi pyöristettyjä suorakulmioita; kortin väri ryhmittelee sisältöä eikä luo uutta runtime-statusta.
- Markdown-rendererin pitää tukea Mermaidin `block`-syntaksia ja diagrammikohtaista config-frontmatteria; yksityiskohtainen Markdown säilyy saavutettavana fallbackina.
- Kaikki uudet initiative-tiedostot ja canvasit jäävät `draft`-tilaan ihmisarvioon asti.

## Hyväksymisaie

| ID | Mitattava kriteeri |
| --- | --- |
| ACPT-CANVAS-001 | Tech Stack Canvas sisältää viralliset 12 elementtiä sekä 12-korttisen pikayhteenvedon ja nimeää version, sizingin, trust boundaryt sekä tunnetut teknologia-/evidenssiaukot. |
| ACPT-CANVAS-002 | Architecture Communication Canvas sisältää viralliset 9 elementtiä sekä yhdeksän kortin pikayhteenvedon ja linkittää vastuut BB-001–BB-009:ään, päätökset ADR:iin sekä laadun QS-skenaarioihin. |
| ACPT-CANVAS-003 | Architecture Inception Canvas sisältää viralliset 8 elementtiä sekä kahdeksan kortin pikayhteenvedon, täsmälleen kolme tärkeintä laatutavoitetta ja eksplisiittisesti merkatut hypoteesit sekä puuttuvan business/evidence-tiedon. |
| ACPT-CANVAS-004 | Jokainen canvas ilmaisee johdetun roolinsa, kanoniset lähteet, päivitystriggerin ja `draft`-statuksen; arc42-indeksi linkittää kaikki kolme. |
| ACPT-CANVAS-005 | `npm run validate:arc42`, canvas-kenttätarkistus ja `git diff --check` läpäisevät; diffi ei koske suojattuja päätös-, design-, config- tai runtime-lähteitä. |
| ACPT-CANVAS-006 | Kaikki kolme Mermaid `block` -diagrammia renderöityvät virheettä SVG:ksi Mermaid CLI 11.12.0:lla; renderöity korttiruudukko on yhdellä silmäyksellä luettava, otsikot eivät leikkaannu ja väliaikaisia renderöintituloksia ei commitoida. |

## Oletus ja hypoteesi

- `ASM-CANVAS-001`: virallisten canvasien nykyiset kentät ovat niiden nimetyillä sivuilla 2026-08-17 näkyvät kentät; ulkoisen lähteen snapshot on tämän initiativen evidenssiä.
- `HYP-CANVAS-001`: kolme toisiaan täydentävää, kanonisiin lähteisiin linkitettyä canvasia lyhentää arkkitehtuurin perehdytys- ja keskustelupolkua lisäämättä rinnakkaista totuutta. Hyöty vaatii myöhemmän ihmis-/käyttöevidenssin eikä ole tämän työn hyväksymisen ehto.

## Kanoniset lähteet ja evidenssi

- Virallinen [Tech Stack Canvas](https://techstackcanvas.io/).
- Virallinen [Architecture Communication Canvas](https://canvas.arc42.org/architecture-communication-canvas).
- Virallinen [Architecture Inception Canvas](https://canvas.arc42.org/architecture-inception-canvas).
- `.ballet/arc42/01-introduction-and-goals.md`–`12-glossary.md`, `.ballet/arc42/TRACEABILITY.md`, `.ballet/goals/**` ja `.ballet/adr/**`.
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `.github/workflows/release.yml`, `README.md`, `backend/`, `frontend/` ja `shared/`.

## Avoimet kysymykset

- `OQ-CANVAS-001` / omistaja: projektin omistaja — hyväksytäänkö kolme draft-canvasia nykytilan tiiviiksi kommunikaatioprojektioiksi?
- `OQ-CANVAS-002` / omistaja: projektin omistaja — tarvitaanko myöhemmin mitattava business-case- tai canvas-käytettävyysbaseline? Tämä ei estä dokumenttien teknistä valmistumista, mutta estää hyötyhypoteesin vahvistamisen.

## Seuraava katselmointiperuste

Ready for review, kun kaikki kolme canvasia on linkitetty, niiden viralliset kentät ja kanoninen omistajuus on tarkistettu ja ACPT-CANVAS-005:n paikallinen evidenssi on kirjattu.
