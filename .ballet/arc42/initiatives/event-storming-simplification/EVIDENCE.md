---
id: event-storming-simplification-evidence
title: Event Stormingin yksinkertaistamisen tarkistukset
status: draft
createdAt: '2026-09-06'
updatedAt: '2026-09-06'
version: 1
tags: [evidence, event-storming, context]
---

# Tarkistusevidenssi

Käyttäjän hyväksymä suunnitelma valtuuttaa vapaaehtoisen prosessikartan, erillisen semantiikka-/layout-tallennuksen, nykyisiin tarinoihin viittaamisen, offline-kontekstin sekä kolmen Event Storming Actionin poistamisen. Yleisiä runtime-versioita, malliasetuksia tai Story-hyväksyntöjä ei muuteta. Muutos ei sisällä pushia, julkaisua tai deployta.

## Toteutuksen rajat

- `model.json`: 113 käsitettä, kuusi prosessia, 112 pysyvää prosessiaskelta, 232 nimettyä yhteyttä, eksplisiittiset vastuurajat, Story-/lähdeviitteet ja säilytetty Markdown-runko. `layout.json`: 233 sijoittelua, 232 nuoliviitettä, 18 kehystä ja 13 näkymää alkuperäisine ID:ineen ja geometrioineen. Kertamuunnoksen lähtöaineisto ja tarkastuskartta ovat testifixturessa `backend/orchestration/project/fixtures/event-storming-v1/`; tuotteen vanha parseri ja Markdown-kirjoituspolku on poistettu.
- Mallilla ja layoutilla on erilliset hashit, atomiset tallennukset, jonot ja konfliktit. Historia käyttää näitä rajoja. Virheellistä JSONia ei ylikirjoiteta; puuttuva tai rikkoutunut layout ei muuta kontekstia.
- Prosessin valinta, askel, vastuunäkymä ja Story-korostus kuuluvat URLiin. Haku, keskeneräisen prosessin authorointi, ehdolliset nuolet, nykyinen canvas, monivalinta, näppäimistö, zoomaus ja undo/redo toimivat. Story-paneeli lukee myös prosessilta periytyvät tarinat nykyisestä lähteestä. Linkitys ja siirtäminen eivät kirjoita tarinatiedostoon.
- HTTP:n ja CLI:n yhteinen semanttinen projektio sisältää vain kohteen, sen haarat/riippuvuudet, tarinat hyväksyntätiloineen ja lähdehashit. Ulkoiset URLit merkitään lukemattomiksi. Oma Git-worktree ja alihakemisto toimivat ilman palvelinta, verkkoa tai runtime-tilan alustusta.
- Introduction & Goals-, Context & Scope-, Glossary-, Design-, Build- ja Acceptance test -Actionien molemmat roolit käyttävät rajattua Event Storming Skilliä. Neljä Statea ja 18 Actionia säilyttävät yleisen Validation/Work-sopimuksen.

## Automatisoitu todentaminen

Suunnittelun lähtötilan kuusi testitiedostoa ja 46 testiä ovat erillistä baseline-evidenssiä. Uuden toteutuksen lopulliset tarkistukset ajettiin 6.9.2026:

| Komento | Tulos |
| --- | --- |
| `npm run test` | 58 testitiedostoa, 415 testiä läpäisi. |
| `npm run validate:arc42` | 12 osiota, 120 dokumenttitunnistetta, config v26, 4 Statea, 18 Actionia. |
| `npm run validate:cutover` | Läpäisi; 619 tiedostoa tarkistettu. |
| `npm run lint` | Läpäisi, ei virheitä tai varoituksia. |
| `npm run build` | TypeScript ja Vite läpäisivät; koonti toistui paikallisessa asennuksessa. |
| `npx @google/design.md lint DESIGN.md` | 0 virhettä, 0 varoitusta. |
| `git diff --check` | Läpäisi. |
| `make latest` | Paikallinen koonti, pakkaus, asennus ja restart läpäisivät. |
| `GET /api/health` | `ok: true`, checkout `/Users/iiro.sinisalo/git/ballet`, portti 53321, startup `2026-09-06T09:32:23.541Z`. Daemon online, Codex ready. |
| Asennettu `ballet context event-storming --json` backend-alihakemistossa | 6 prosessin ja 15 tarinan indeksi. |
| Asennettu `ballet context event-storming --process 598ff734-ac7f-47f6-bd92-2fc73cdf6e88 --json` `.ballet/event-storming`-alihakemistossa | 1 prosessi, 20 askelta, 43 yhteyttä/rajattua liittymää ja 7 paikallisen lähteen hashia; ei layoutia. |

Asennetun CLI:n semanttinen hash oli `cb4ac336e0d7a6279cb2b95b8b8432166abceba48fb72e0538466ea8dd47ae82`. Paketin SHA-256 oli `dd4e4bb4d1a8f1c494877bfd55c4ba7a7003910cc8970e2c55e1e0f741cd4050`. Tämä paikallinen asennus ei julkaissut pakettia eikä tehnyt pushia tai deployta.

Testit kattavat deterministisen JSONin ja semanttisen hashin, pysyvät ID:t ja toistuvan käsitteen, viite-/versio-/kokorajat, turvalliset polut, rename-virheen atomisuuden ja väliaikaistiedoston siivouksen, tiedostojen erilliset konfliktit, layoutin täydellisen kontekstieristyksen, Story-linkityksen/irrotuksen/poistoneston ja muuttumattomat hyväksytyn tarinan tavut. Gitissä poistettu lähde säilyy korjattavana viitteenä eikä saa uusia linkkejä.

HTTP-testit kattavat erilliset model/layout-hashit, kontekstiprojektion, tuntemattomat kentät/valitsimet, hostile Origin -pyynnöt, kokorajan ja aktiivisen Runin kirjoituslukon. CLI-testi käyttää erillistä Git-worktreetä alihakemistosta ja estää fetchin; tuntematon kohde ei laajene koko kartaksi. Kontekstin retry-haara ja ulkoiset päätepisteet sekä repositoryn blocked-/peruutuspolut säilyvät. Koostumustesti tarkistaa oikeat Action/TOML/Skill-kytkennät; planner-testi säilyttää kohteen molempien roolien inputissa ilman mallin tai tarinoiden injektiota.

Tämä ei ole väite koko työn TDD red-to-green -järjestyksestä tai tarinoiden ihmishyväksynnästä.

## Selain-QA

Selainkoe tehtiin erillisessä väliaikaisessa Git-checkoutissa ko'oissa 1440×900 ja 390×844. Tuotteen nykyistä prosessia tai tarinaa ei muutettu QA:ta varten. Testissä luotiin keskeneräinen prosessi ja kaksi tapahtumaa, linkitettiin nykyinen tarina, luettiin järjestetyt kriteerit ja lisättiin nimetty yhteys ehdolla. Tallennus, undo/redo, haku, selainhistoria ja uudelleenlataus säilyttivät sisällön.

Näppäimistön nuolinäppäin tallensi kortin siirron layoutiin; Cmd-Z perui sen. Shift-valinta valitsi kaksi korttia. Vanhasta prosessista avattiin valinnainen vastuunäkymä, jossa näkyi 38 yhteyttä. Sivun leveys oli 1440/1440 ja 390/390 pikseliä. Mobiilin sulkemispainike pysyy näkyvissä kriteerien vierityksessä (40×40 px), Escape sulkee sheetin ja palauttaa fokuksen avaavaan ohjaimeen. Reduced motion -tilassa paneelin transition on 0 s. Tyypit ja statukset näkyvät tekstinä ja symboleina.

Selainkokeessa löydetty ja korjattu nuolten katoaminen uudelleenavauksessa johtui React Flow -korttien puuttuvasta mittatiedosta. Viimeinen uudelleenlataus näyttää yhteyden ja avaa ehdon sivupaneeliin. Kuvakaappaukset: `output/playwright/storm-overview-desktop.png` (myös asennettu koonti), `storm-created-desktop.png` ja `storm-criteria-mobile.png`. Story-korostus merkitsi molemmat linkitetyn prosessin kortit. User Stories -listan takaisinlinkki avasi prosessin oikealla Story-korostuksella. QA-checkoutin Git-diff sisälsi vain mallin ja layoutin; tarinoiden tavut säilyivät.
