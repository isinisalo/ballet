---
id: adr-012
title: ulkoisten palveluiden integraatiorajat
created_date: '2026-06-06 07:19'
updated_date: '2026-06-23 07:19'
status: accepted
---
## Context
Järjestelmä tarvitsee pysyvät rajat markkinadatan, yritysten perustietojen ja yrityksiin liittyvän keskusteluaineiston ulkoisille lähteille. Päätös 002 valitsee lähteiksi EODHD:n, Inderes Forumin ja PRH:n YTJ Open Data API v3:n. Tämä päätös lukitsee näiden lähteiden integraatiotason rajat, konfiguraatioavaimet ja tuotantokäytön stop-säännöt.

## Decision
Ulkoiset palvelut integroidaan backendin ulos menevien adapterien kautta. Domain ja use caset käyttävät portteja, eivät HTTP-clienttejä, lähdekohtaisia request/response-malleja tai provider-kohtaisia virheitä.

Hyväksytyt base URL -konfiguraatioavaimet ovat:

- `EODHD_BASE_URL`: `https://eodhd.com`
- `PRH_BASE_URL`: `https://avoindata.prh.fi/opendata-ytj-api/v3`
- `INDERES_BASE_URL`: `https://forum.inderes.com`

Hyväksytyt lähdekohtaiset vastuut ovat:

- EODHD tuottaa seurattavien yritysten markkinadataa.
- PRH:n YTJ Open Data API v3 tuottaa seurattavien suomalaisten yritysten perustietoa.
- Inderes Forum tuottaa yritykseen liittyvää keskusteluaineistoa yritykselle määritetyn topic id:n perusteella.

Topic id kuuluu Companies/watchlist-kontekstin yritys- tai keruuasetuksiin. Comments-kontekstin Inderes-adapteri saa topic id:n sovitun portin tai use case -syötteen kautta, ei kovakoodattuna adapteriin.

## Consequences

- Base URL -arvot ovat ei-salaisia konfiguraatioarvoja. API-avaimet, credentialit, session-arvot ja muut salaisuudet säilytetään erillisissä salaisuuslähteissä hyväksytyn infra- ja security-rajan mukaisesti.
- Tokenillisia URL:eja, salaisia query-parametreja, API-avaimia tai cookie-/session-arvoja ei saa tallentaa ADR:iin, intent-dokumentteihin, speciin, fixtureihin, testidataan, lokiin tai lähdekoodiin.
- Lähdekohtainen raw-data normalisoidaan context-kohtaiseksi dataksi ennen domainiin, persistenceen tai julkiseen API:in päätymistä.
- Tallennettuun ulkoiseen dataan liitetään vähintään lähde ja hakuajankohta. Detail-spesifikaatio määrittää lähdekohtaiset tunnisteet, deduplikointirajat ja retentionin.
- Paikallinen kehitys ja testit käyttävät mock-only-lähteitä. Mockoonia voidaan käyttää paikallisiin REST-mockeihin, ja adapteritestit käyttävät HTTP-mockeja ilman tuotantokutsuja.
- Tuotantokäyttö vaatii dokumentoidut käyttöehdot, kutsurajat, aikakatkaisut, retry-rajat, virheluokat, retentionin, credential-käsittelyn ja lokitusrajat.
- Inderes Forum -keruu ei ole yleinen keskustelu- tai sosiaalisen median keräin. Keruu rajataan hyväksyttyyn yrityskohtaiseen topic id:hen.
- EODHD-dataa ei saa käyttää sijoitusneuvonnan, osto- tai myyntisuositusten, automaattisten kaupankäyntipäätösten tai kaupankäyntitoiminnallisuuden tuottamiseen.
- PRH-dataa ei saa käyttää yleisen yritysrekisterin rakentamiseen projektin seuranta- ja perustietotarvetta laajemmin.
- Jos tuotantokutsu, credential, käyttöehtoevidenssi, kutsuraja, retention, PII-käsittely tai lähdekohtainen virheluokitus puuttuu, agentin tulee estää tuotantokeruu ja merkitä kyseinen osa blocked-tilaan tai pyytää käyttäjän päätös.
