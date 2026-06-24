---
id: adr-008
title: backend-arkkitehtuurimalli
created_date: '2026-06-06 07:19'
updated_date: '2026-06-23 07:19'
status: accepted
---
## Context
Backend tarvitsee rakenteen, joka tekee business-käsitteet näkyviksi ja erottaa domainin HTTP:stä, AWS-palveluista, tietokannasta ja ulkoisista integraatioista.

## Decision
Backend toteutetaan Hexagonal Architecture / Ports and Adapters -mallilla, paketoidaan Screaming Architecture -periaatteella ja business-logiikka mallinnetaan Domain Driven Design -periaatteilla.

Projektin bounded contextit ovat Auth, Notifications, Companies and watchlist, Marketdata, Comments ja Scheduling.

## Consequences

- Domain ja use caset pysyvät riippumattomina FastAPI:sta, AWS SDK:sta, PynamoDB:stä, Pydanticista ja muista ulkokerroksen kirjastoista.
- Sisään tulevat adapterit kutsuvat use case -rajapintoja ja ulos menevät adapterit toteuttavat portteja.
- Pakettirakenteen tulee kuvata domainia ja käyttötapauksia, ei pelkkiä teknisiä kerroksia kuten `controllers`, `models` tai `services`.
- Aggregatet vastaavat invariansseistaan, entityillä on identiteetti ja value objectit ovat muuttumattomia arvoja.
- Domain ei saa sisältää HTTP-, AWS-, tietokanta- tai Pydantic-malleja.
- Uusi bounded context, julkinen API-sopimus, liiketoimintasääntö, retention-sääntö, jaettu domain-paketti tai cross-context deletion -politiikka vaatii erillisen hyväksynnän.
- Testaus voidaan kohdistaa domainiin ja use caseihin ilman infrastruktuuria.
