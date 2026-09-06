---
id: adr-records-event-storming-evidence
title: ADR-recordien ja Event Stormingin tarkistukset
status: draft
createdAt: '2026-09-06'
updatedAt: '2026-09-06'
version: 1
tags: [evidence, adr, event-storming]
---

# Tarkistusevidenssi

Käyttäjän hyväksymä suunnitelma valtuuttaa suomenkieliset kolmiriviset ADR:t, korttilistan ja rakenteisen lomakkeen sekä nykyiseen dokumentaatioon perustuvan 13 taulun Event Storming -mallin. Tarinoita ei hyväksytä eikä julkaisua tehdä.

## Toteutus ja sisältö

- 21 aktiivista suomenkielistä ADR-recordia, yhteinen tiukka parseri ja serialisoija sekä korttilista ja kolmen kentän lomake. Säilyvien ADR:ien tiedostopolut ja sisältö/hash-rajapinnat säilyvät.
- 15 suomenkielistä Draft-tarinaa Given/When/Then-kriteereineen. Kahdeksan aiemman tarinan tunnisteet säilyvät; hyväksyntöjä ei ole luotu.
- 113 lähteistettyä Event Storming -korttia 13 taululla: 1 Big Picture, 6 Process Modelling ja 6 Software Design. Prosessit ja vastuurajat jakavat korttitunnisteita; lähdetaulut yhdistävät tasot.
- [Siirtokartoitus](../../ADR-CONTENT-MAP.md) kattaa lähtörevision 48 ADR:ää. Korvattu historia luetaan alkuperäisestä Git-revisiosta, eikä uutta arkistoa ole luotu. Malli kuvaa repository-evidenssiä; sitä ei esitetä toteutuneena sidosryhmätyöpajana.

## Suoritetut tarkistukset 6.9.2026

| Tarkistus | Tulos |
| --- | --- |
| `npm run test` | 54 testitiedostoa, 407 testiä läpäisi. |
| `npm run lint` | Läpäisi ilman varoituksia. |
| `npm run build` | TypeScript- ja frontend-koonti läpäisi; koonti suoritettiin myös `make latest` -ajossa. |
| `npm run validate:arc42` | Läpäisi: 12 osiota, 119 dokumenttitunnistetta, config 26, 5 Statea ja 21 Actionia. |
| `npm run validate:cutover` | Läpäisi, 564 tiedostoa tarkistettu. |
| `npx @google/design.md lint DESIGN.md` | Läpäisi: 0 virhettä, 0 varoitusta. |
| `git diff --check` | Läpäisi. |
| `make latest` ja käynnistystarkistus | Paikallinen paketti rakennettiin ja asennettiin. Ballet käynnistyi osoitteeseen `http://127.0.0.1:53321`; palvelu ja daemon raportoivat `running: true`, Codex `ready`. |

Parseri- ja API-testit kattavat muodon, pakolliset kentät, tunnistevastaavuuden, duplikaatit, frontmatterin ja ylimääräisen sisällön hylkäyksen sekä konfliktit. UI-testit kattavat korttijärjestyksen, luonnin, muokkauksen, tallennuksen paluun ja fokuksen, viite-estetyn poiston, virheelliset reitit ja kadonneen tiedoston luonnoksen säilymisen. Projektitesti tarkistaa mallin kolme tasoa, lähteet ja keskeiset poikkeuspolut. Tulokset eivät tarkoita kaikkien projektitarinoiden hyväksymiskriteerien hyväksyntää.

## Selainhavainnot

ADR-lista ja lomake tarkistettiin ko'oissa 1440 × 900 ja 390 × 844. Sivulle ei muodostu vaakasuuntaista ylivuotoa. Mobiililomakkeen toimintopalkin painikkeiden korkeus on 44 px; takaisin-painike on 44 × 44 px. Otsikko, Päätös ja Soveltamisala näkyvät sinisenä, oranssina ja lilana tekstilabeleineen. ADR-007:n todellinen tallennus palautti listaan, fokus siirtyi `card-adr-007`-korttiin ja sisältö säilyi uudelleenladattaessa. Näppäimistön Tab siirsi fokuksen Päätös-kentästä Soveltamisala-kenttään.

Event Stormingin tauluvalitsin näyttää kaikki 13 taulua. Big Picture sekä prosessi- ja ohjelmistosuunnittelutaulut avautuvat; yhteiset kortit ja lähdetaulutoiminto näkyvät. Mallia tarkasteltiin työpöytä- ja mobiilikoossa. Kanvaasin zoomaus ja sovitus ovat tarpeen laajan kokonaiskuvan lukemiseen.

Selainautomaation rajoitus: tallentamattoman luonnoksen Peruuta-toiminnon natiivi vahvistusdialogi aiheutti työkalun aikakatkaisun, joten dialogin hyväksymistä ja hylkäämistä ei varmennettu selaimessa. Muutossuoja käyttää olemassa olevaa yhteistä navigointisuojaa; automaattitestit kattavat luonnoksen muutostilan ja konfliktien säilyttämisen.

Tämä ei ole TDD red-to-green -väite: parserin ensimmäinen testikutsu ei löytänyt shared-hakemiston testiä, minkä jälkeen testi siirrettiin backend-testiprojektin piiriin. Toteutuksen puuttumisesta johtuvaa red-vaihetta ei tallennettu.
