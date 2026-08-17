---
id: arc42-initiative-comprehensive-arc42-documentation-brief
title: Kattavan arc42-dokumentaation BRIEF
status: draft
createdAt: '2026-08-17'
updatedAt: '2026-08-17'
version: 1
tags:
  - arc42
  - initiative
  - documentation
  - brief
---

# Comprehensive arc42 documentation — BRIEF

## Initiative

- Initiative ID: `comprehensive-arc42-documentation`
- Omistaja ja hyväksyjä: projektin omistaja
- Tila: `draft`, kunnes ihmisarvio hyväksyy dokumentaation
- Goal/REQ: `goal-001`–`goal-011`, `REQ-001`–`REQ-011`
- QS: `QS-001`–`QS-013`; prioriteetti 1 erityisesti `QS-011`–`QS-013`

## Fakta

Aktiivinen arc42-korpus sisältää virallisen arc42-rakenteen kaikki 12 osiota, mutta lähtötilan kuvaukset ovat tiiviitä ja osin englanninkielisiä. Nykyinen työpuu sisältää paikallisesti validoituja Loop Engineer- ja Run mission control -muutoksia, joita aiempi dokumentaatio ei kuvaa riittävällä rakenne-, runtime- ja trace-tasolla.

## Ihmisen päätös

Käyttäjä valtuutti 2026-08-17 aktiivisen arkkitehtuurikorpuksen suomentamisen ja kattavan laajennuksen kuitenkaan muuttamatta hyväksyttyä WHAT/WHY:tä, ADR-päätöksiä, runtime-sopimuksia, tietokantaa tai projektikonfiguraatiota. Käyttäjä hyväksyi `QS-011`–`QS-013`-skenaarioiden prioriteetin 1 ja niiden liittämisen trace-ketjuihin.

## Sidosryhmät

- Arkkitehti tarvitsee yhtenäisen context-, building block-, runtime-, deployment-, concept-, decision-, quality- ja riskinäkymän.
- Kehittäjä tarvitsee vastuut, rajapinnat, invariantit, lähdekoodiankkurit ja testit ilman kopioitua symbolikatalogia.
- AI-agentti tarvitsee kanonisen omistajuuden, vakaat ID:t, eksplisiittisen evidenssistatuksen ja pysähtymisrajat.
- Projektin omistaja tarvitsee erotellun päätöksen, toteutetun faktan, paikallisen evidenssin ja avoimen riskin.

## Laajuus

- Laajenna ja suomenna aktiiviset arc42-osiot 1–12.
- Lisää tasan kahdeksan yksinkertaista Mermaid-kaaviota.
- Suomenna aktiiviset tukidokumentit ja synkronoi vanhentunut strict-v10-sanasto hyväksyttyihin Goal-lähteisiin.
- Lisää `QS-011`–`QS-013`, `RT-008`–`RT-010`, `TEST-011`–`TEST-013`, `EVID-011`–`EVID-013`, `RISK-011` ja `RISK-012`.
- Todennetaan dokumentaatio, relevantit runtime/UI-polut, Mermaid-renderöinti ja conformance.

## Ei-tavoitteet

- Ei muutoksia ADR-päätöksiin, `DESIGN.md`:ään, `.ballet/project.json`:iin, runtime-koodiin, TypeScript-tyyppeihin, JSON-skeemoihin tai tietokantaan.
- Ei historiallisten migration- tai initiative-evidenssien uudelleenkirjoitusta.
- Ei commitia, mergeä, pushia, releasea, deployta tai rollbackia.

## Rajoitteet ja kontekstirajat

CTR-001–CTR-011 säilyvät. Olemassa olevat käyttäjän commitoimattomat frontend- ja design-muutokset ovat käyttäjän omaisuutta ja jäävät muuttumattomiksi. Aktiivinen proosa kirjoitetaan suomeksi, mutta lähdekoodin nimet, stable ID:t ja vakiintuneet Ballet-termit säilyvät englanniksi.

## Laatutavoitteet ja hyväksymisaie

- Kaikki `REQ-001`–`REQ-011` saavat mitattavan trace-ketjun.
- `QS-011`: composition on tavutasolla deterministinen eikä käytä provider-fallbackia.
- `QS-012`: restart/cancellation ei hävitä, replayaa tai monista commitoitua runtime-vaikutusta.
- `QS-013`: Run UI projisoi vain canonical persistence- ja snapshot-faktoja eikä keksi progressia.
- Kahdeksan Mermaid-lohkoa renderöityy SVG:ksi väliaikaisesti.
- Pyydetyt testit ja validoinnit raportoidaan totuudenmukaisesti; failed/pending-tulosta ei merkitä verifiediksi.

## Oletus

Nykyinen toteutus ja testit ovat riittävä paikallinen baseline arkkitehtuurifaktojen kuvaamiseen, mutta eivät itsessään hyväksy initiativea ilman ihmisarviota.

## Hypoteesi

Riskiperusteinen, lähdeankkuroitu 12-osioinen kuvaus vähentää arkkitehtuurin tulkintavaihtelua sekä ihmisillä että AI-agenteilla ilman ylläpidettävää endpoint- tai symbolikatalogia.

## Avoimet kysymykset

- Projektin omistaja hyväksyy tai palauttaa draft-korpuksen lopullisen conformance review’n perusteella.

## Seuraava katselmointiperuste

BRIEF on valmis arvioitavaksi yhdessä PLAN-, EVIDENCE- ja REVIEW-tiedostojen kanssa, kun kaikki tarkistukset on ajettu ja tulokset kirjattu.
