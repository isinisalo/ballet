---
id: arc42-section-02
title: Rajoitteet
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 3
tags:
  - arc42
  - constraints
arc42Section: 2
---

# 2. Rajoitteet

## Tarkoitus

Tämä osio kirjaa tekniset, organisatoriset ja menettelylliset rajat, jotka rajaavat arkkitehtuurivaihtoehtoja. Rajoite on eri asia kuin nykyinen toteutusvalinta: hyväksytyn rajoitteen muuttaminen edellyttää sen omistavan Goalin, ADR:n tai ihmisvaltuutuksen käsittelyä.

## Tila

Rajoitteet perustuvat hyväksyttyihin Goaleihin ja ADR:iin, repository-ohjeisiin sekä toteutettuihin runtime-sopimuksiin. Seuraus-sarake tekee näkyväksi, mitä kukin rajoite arkkitehtuurilta vaatii.

## Tekniset ja alusta-rajoitteet

| ID | Rajoite | Arkkitehtuurin seuraus | Neuvoteltavuus | Lähde |
| --- | --- | --- | --- | --- |
| CTR-001 | Palvelu bindaa loopbackiin ja kuuluu yhdelle täsmälliselle Git-checkoutille. | Checkout ratkaistaan ennen palvelua; API:ta ei julkaista verkkoon eikä risti-checkout-tilaa jaeta. | Goal/ADR vaaditaan | goal-001, adr-001, adr-008 |
| CTR-002 | Tuettu jakelu on macOS arm64/x64 ja lifecycle käyttää launchd:tä. | Packaging, asennuspolut ja operointiohjeet ovat macOS-kohtaisia; Linux/Windows eivät ole implisiittisesti tuettuja. | Uusi Goal/ADR | goal-008, adr-009 |
| CTR-003 | Frontend, backend ja shared contracts muodostavat yhden TypeScript-sovellusarkkitehtuurin. | Tyypitetyt sopimukset ja yhteinen build/test-ketju ovat ensisijaisia; erillistä palveluverkkoa ei lisätä. | ADR vaaditaan | adr-003 |
| CTR-004 | Runtime-totuus on checkout-local SQLite `.git/ballet`-hakemistossa eikä versionhallittua projektitotuutta. | State, Runit, jonot ja tapahtumat palautuvat lokaalisti; Goals/ADR/arc42 eivät kopioidu kantaan kanonisena sisältönä. | ADR vaaditaan | adr-002, adr-007, adr-015 |
| CTR-009 | `ExecutionProfile` ei sisällä Responses API:n `reasoning.mode`-kenttää; projektin baseline on `medium`, kunnes eval-evidenssi perustelee muutoksen. | Provider-kohtaisia piilovalintoja tai “pro mode” -oletusta ei tehdä; profiili ratkaistaan project-local-konfiguraatiosta. | Eval + hyväksyntä | adr-012 |

## Turvallisuus- ja luottamusrajoitteet

| ID | Rajoite | Arkkitehtuurin seuraus | Neuvoteltavuus | Lähde |
| --- | --- | --- | --- | --- |
| CTR-005 | Verkko on pois päältä, ellei `ExecutionProfile` salli sitä; Node-kirjoitukset pysyvät Root Run -worktreessä. | Tehtävä koostetaan eksplisiittisillä oikeuksilla, active checkoutia ei muokata ja väärä konteksti pysäyttää ajon. | Profiili + ihmisvalta | goal-005, adr-006, adr-008 |
| CTR-008 | Merge, push, release, deploy ja rollback vaativat täsmällisen ihmisvaltuutuksen. | Validation tai onnistunut testi ei itsessään valtuuta ulkoista kirjoitusta; automaattinen julkaisu ei kuulu oletus-flow’hun. | Ei agentin neuvoteltavissa | goal-005, goal-009, adr-011 |
| CTR-011 | Loop-paketti on rajattu epäluotettu UTF-8 JSON, sisältää yhden Loopin eikä suoritettavaa koodia tai ulkoisia kirjoituksia. | Backend tarkastaa sisällön, näyttää provenance/trust-tiedot ja materialisoi vain hyväksytyt project-local-resurssit; runtime ei riipu paketista. | ADR vaaditaan | goal-010, adr-016 |

## Organisatoriset ja menetelmärajoitteet

| ID | Rajoite | Arkkitehtuurin seuraus | Neuvoteltavuus | Lähde |
| --- | --- | --- | --- | --- |
| CTR-006 | Projektikohtainen workflow kuuluu vain `.ballet/project.json`, `.ballet/instructions/**`, `.agents/skills/**` ja `.ballet/arc42/**` -lähteisiin. | Platform-koodi tarjoaa yleisiä primitivejä eikä kovakoodaa roadmap-, milestone-, release- tai arc42-Loop-tunnisteita. | ADR vaaditaan | adr-011, adr-013, adr-014 |
| CTR-007 | Agentti ei keksi puuttuvaa WHAT/WHY:tä eikä muuta hyväksytyn ADR:n semantiikkaa hiljaisesti. | Epäselvä prioriteetti, laatumitta tai merkittävä valinta johtaa `needs_input`-tilaan tai uuteen ADR-ehdotukseen. | Ei agentin neuvoteltavissa | goal-009, adr-011 |
| CTR-010 | `DESIGN.md` omistaa UI-tokenit ja visuaaliset periaatteet. | Frontend käyttää olemassa olevaa design-kieltä; arkkitehtuuridokumentaatio kuvaa UI:n totuuslähteen muttei luo rinnakkaisia design-tokeneita. | Design-päätös vaaditaan | goal-007, DESIGN.md |

## Rajoitteiden yhteisvaikutus

- CTR-001, CTR-004 ja CTR-005 pakottavat selkeän eron versionhallittuun intentioon, machine-local runtimeen ja eristettyyn worktreehen.
- CTR-006 ja CTR-007 estävät Ballet-platformia muuttumasta yhden projektin prosessimoottoriksi.
- CTR-008 ja CTR-011 tekevät kahdesta eri rajasta eksplisiittisen: epäluotetun authoring-sisällön materialisointi ja ulkoisen vaikutuksen valtuutus.
- CTR-009 rajoittaa provider-optimoinnin mitattavaan `ExecutionProfile`-evidenssiin; adapteri ei saa korvata puuttuvaa päätöstä fallbackilla.

## Kanoniset lähteet

Hyväksytyt Goalit ja ADR:t, `AGENTS.md`, `DESIGN.md`, `.ballet/project.json` sekä `README.md`:ssä kuvatut machine-local-runtime-sopimukset.

## Relevantit päätökset

`adr-001`, `adr-002`, `adr-003`, `adr-006`, `adr-008`, `adr-009` ja `adr-011`–`adr-016`.

## Evidenssi

Strict-skeemat, runtime- ja pakettitestit, platform-boundary-haku sekä arc42-validointi osoittavat teknistä noudattamista. Ihmisvaltuutusta koskeva evidenssi syntyy vasta sitä vaativassa Runissa.

## Avoimet kysymykset

- Linux- tai Windows-tuki vaatii uuden Goalin ja ADR:n; sitä ei oleteta.
- Baselinea suurempi reasoning effort vaatii nimettyä eval-aineistoa ja päätöksen, ei dokumenttitekstin päivitystä yksin.

## Seuraava katselmointiperuste

Katselmoi osio, kun alustatuki, turvallisuuspolitiikka, model-capability, package trust tai project/workflow-omistajuus muuttuu.
